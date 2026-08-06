import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db";
import authMiddleware from "../middleware/authMiddleware";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
} from "../services/emailService";

const router = Router();

type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  email_verified: boolean;
};

function signUserToken(user: AuthUser): string {
  const jwtSecret = process.env.IDENTITY_JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("IDENTITY_JWT_SECRET is not set");
  }

  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.email_verified,
    },
    jwtSecret,
    { expiresIn: "1h" }
  );
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const passwordResetResponse = {
  message: "If an account exists for that email, a reset link has been sent",
};

const emailVerificationResponse = {
  message:
    "If an unverified account exists for that email, a verification link has been sent",
};

function createEmailVerificationToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

router.get("/test", (_req, res) => {
  return res.status(200).json({
    message: "Auth routing works",
  });
});

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      message: "Name is required",
    });
  }

  const normalizedName = name.trim();

  if (normalizedName.length > 255) {
    return res
      .status(400)
      .json({ message: "Name must be 255 characters or fewer" });
  }

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (normalizedEmail.length > 255 || !emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return res
      .status(400)
      .json({ message: "Password must be 72 bytes or fewer" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await client.query<AuthUser>(
      "INSERT INTO users (name, email, password, email_verified) VALUES ($1, $2, $3, FALSE) RETURNING id, name, email, role, email_verified;",
      [normalizedName, normalizedEmail, hashedPassword]
    );
    const user = result.rows[0];
    const verification = createEmailVerificationToken();
    await client.query(
      `
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')
      `,
      [user.id, verification.tokenHash]
    );
    await sendEmailVerification({
      recipientEmail: user.email,
      displayName: user.name,
      verificationToken: verification.token,
    });
    await client.query("COMMIT");

    return res.status(201).json({
      message: "Registration successful. Check your email to verify your account",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[IDENTITY] Failed to rollback registration:", rollbackError);
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      typeof error.constraint === "string" &&
      error.constraint.includes("email")
    ) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    console.error("[IDENTITY] Register failed:", error);
    return res.status(500).json({
      message: "Failed to register user",
    });
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (
    typeof email !== "string" ||
    email.trim().length === 0 ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, password, role, email_verified FROM users WHERE LOWER(email) = $1;",
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        message: "Email verification required",
      });
    }

    const token = signUserToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
      },
    });
  } catch (error) {
    console.error("[IDENTITY] Login failed:", error);
    return res.status(500).json({
      message: "Failed to login",
    });
  }
});

router.post("/verify-email", async (req, res) => {
  const token = req.body.token;

  if (typeof token !== "string" || token.trim().length === 0) {
    return res.status(400).json({ message: "Verification token is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const tokenResult = await client.query<{ user_id: number }>(
      `
        SELECT token.user_id
        FROM email_verification_tokens token
        WHERE token.token_hash = $1
          AND token.used_at IS NULL
          AND token.expires_at > CURRENT_TIMESTAMP
        FOR UPDATE
      `,
      [hashResetToken(token.trim())]
    );
    const verificationToken = tokenResult.rows[0];

    if (!verificationToken) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Verification link is invalid or has expired" });
    }

    await client.query(
      "UPDATE users SET email_verified = TRUE WHERE id = $1",
      [verificationToken.user_id]
    );
    await client.query(
      `
        UPDATE email_verification_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND used_at IS NULL
      `,
      [verificationToken.user_id]
    );
    await client.query("COMMIT");

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[IDENTITY] Failed to rollback email verification:",
        rollbackError
      );
    }
    console.error("[IDENTITY] Email verification failed:", error);
    return res.status(500).json({ message: "Failed to verify email" });
  } finally {
    client.release();
  }
});

router.post("/resend-verification", async (req, res) => {
  const email = req.body.email;

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const userResult = await pool.query<AuthUser>(
      `
        SELECT id, name, email, role, email_verified
        FROM users
        WHERE LOWER(email) = $1
      `,
      [email.trim().toLowerCase()]
    );
    const user = userResult.rows[0];

    if (!user || user.email_verified) {
      return res.status(200).json(emailVerificationResponse);
    }

    const recentToken = await pool.query(
      `
        SELECT id
        FROM email_verification_tokens
        WHERE user_id = $1
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds'
        LIMIT 1
      `,
      [user.id]
    );

    if (recentToken.rowCount && recentToken.rowCount > 0) {
      return res.status(200).json(emailVerificationResponse);
    }

    const verification = createEmailVerificationToken();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE email_verification_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND used_at IS NULL
        `,
        [user.id]
      );
      await client.query(
        `
          INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')
        `,
        [user.id, verification.tokenHash]
      );
      await sendEmailVerification({
        recipientEmail: user.email,
        displayName: user.name,
        verificationToken: verification.token,
      });
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[IDENTITY] Failed to rollback verification resend:",
          rollbackError
        );
      }
      console.error("[IDENTITY] Failed to resend verification email:", error);
    } finally {
      client.release();
    }

    return res.status(200).json(emailVerificationResponse);
  } catch (error) {
    console.error("[IDENTITY] Verification resend failed:", error);
    return res
      .status(500)
      .json({ message: "Failed to request email verification" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const email = req.body.email;

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const userResult = await pool.query<AuthUser>(
      "SELECT id, name, email, role FROM users WHERE LOWER(email) = $1",
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(200).json(passwordResetResponse);
    }

    const recentTokenResult = await pool.query(
      `
        SELECT id
        FROM password_reset_tokens
        WHERE user_id = $1
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds'
        LIMIT 1
      `,
      [user.id]
    );

    if (recentTokenResult.rowCount && recentTokenResult.rowCount > 0) {
      return res.status(200).json(passwordResetResponse);
    }

    const resetToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(resetToken);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE password_reset_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND used_at IS NULL
        `,
        [user.id]
      );
      await client.query(
        `
          INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes')
        `,
        [user.id, tokenHash]
      );
      await sendPasswordResetEmail({
        recipientEmail: user.email,
        displayName: user.name,
        resetToken,
      });
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[IDENTITY] Failed to rollback password reset request:",
          rollbackError
        );
      }
      console.error("[IDENTITY] Failed to send password reset email:", error);
    } finally {
      client.release();
    }

    return res.status(200).json(passwordResetResponse);
  } catch (error) {
    console.error("[IDENTITY] Password reset request failed:", error);
    return res.status(500).json({ message: "Failed to request password reset" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (typeof token !== "string" || token.trim().length === 0) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters" });
  }

  if (Buffer.byteLength(newPassword, "utf8") > 72) {
    return res
      .status(400)
      .json({ message: "New password must be 72 bytes or fewer" });
  }

  const tokenHash = hashResetToken(token.trim());
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const tokenResult = await client.query<{ id: number; user_id: number }>(
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        FOR UPDATE
      `,
      [tokenHash]
    );
    const resetToken = tokenResult.rows[0];

    if (!resetToken) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Reset link is invalid or has expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      resetToken.user_id,
    ]);
    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND used_at IS NULL
      `,
      [resetToken.user_id]
    );
    await client.query("COMMIT");

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[IDENTITY] Failed to rollback password reset:",
        rollbackError
      );
    }
    console.error("[IDENTITY] Password reset failed:", error);
    return res.status(500).json({ message: "Failed to reset password" });
  } finally {
    client.release();
  }
});

router.get("/users", authMiddleware, async (req, res) => {
  const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = idsParam
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (ids.length === 0) {
    return res.status(200).json([]);
  }

  try {
    const result = await pool.query(
      "SELECT id, name FROM users WHERE id = ANY($1::int[]) ORDER BY id;",
      [Array.from(new Set(ids))]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("[IDENTITY] User lookup failed:", error);
    return res.status(500).json({ message: "Failed to get users" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, role, email_verified FROM users WHERE id = $1;",
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = result.rows[0];
    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.email_verified,
    });
  } catch (error) {
    console.error("[IDENTITY] Current user lookup failed:", error);
    return res.status(500).json({ message: "Failed to get current user" });
  }
});

router.patch("/me", authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { name } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      message: "Name is required",
    });
  }

  const normalizedName = name.trim();

  if (normalizedName.length > 255) {
    return res.status(400).json({
      message: "Name must be 255 characters or fewer",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET name = $1
        WHERE id = $2
        RETURNING id, name, email, role, email_verified
      `,
      [normalizedName, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = result.rows[0] as AuthUser;

    return res.status(200).json({
      token: signUserToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
      },
    });
  } catch (error) {
    console.error("[IDENTITY] Profile name update failed:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

router.patch("/me/password", authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return res.status(400).json({ message: "Current password is required" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters" });
  }

  if (Buffer.byteLength(newPassword, "utf8") > 72) {
    return res
      .status(400)
      .json({ message: "New password must be 72 bytes or fewer" });
  }

  try {
    const currentUserResult = await pool.query<{ password: string }>(
      "SELECT password FROM users WHERE id = $1",
      [req.user.id]
    );
    const currentUser = currentUserResult.rows[0];

    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await bcrypt.compare(currentPassword, currentUser.password))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (await bcrypt.compare(newPassword, currentUser.password)) {
      return res
        .status(400)
        .json({ message: "New password must be different from current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      req.user.id,
    ]);

    return res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.error("[IDENTITY] Profile password update failed:", error);
    return res.status(500).json({ message: "Failed to update password" });
  }
});

export default router;
