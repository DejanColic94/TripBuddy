import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db";
import authMiddleware from "../middleware/authMiddleware";
import { sendPasswordResetEmail } from "../services/emailService";

const router = Router();

type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

function signUserToken(user: AuthUser): string {
  const jwtSecret = process.env.IDENTITY_JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("IDENTITY_JWT_SECRET is not set");
  }

  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
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

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role;",
      [name.trim(), email, hashedPassword]
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (error) {
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
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, password, role FROM users WHERE email = $1;",
      [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({
        message: "Invalid credentials",
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
      },
    });
  } catch (error) {
    console.error("[IDENTITY] Login failed:", error);
    return res.status(500).json({
      message: "Failed to login",
    });
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
      "SELECT id, name, email, role FROM users WHERE id = $1;",
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json(result.rows[0]);
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
        RETURNING id, name, email, role
      `,
      [normalizedName, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = result.rows[0] as AuthUser;

    return res.status(200).json({
      token: signUserToken(user),
      user,
    });
  } catch (error) {
    console.error("[IDENTITY] Profile name update failed:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

router.patch("/me/email", authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { email, currentPassword } = req.body;

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ message: "New email is required" });
  }

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return res.status(400).json({ message: "Current password is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (normalizedEmail.length > 320 || !emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  try {
    const currentUserResult = await pool.query<
      AuthUser & { password: string }
    >(
      "SELECT id, name, email, role, password FROM users WHERE id = $1",
      [req.user.id]
    );
    const currentUser = currentUserResult.rows[0];

    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!(await bcrypt.compare(currentPassword, currentUser.password))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (currentUser.email.trim().toLowerCase() === normalizedEmail) {
      return res
        .status(400)
        .json({ message: "New email must be different from current email" });
    }

    const result = await pool.query<AuthUser>(
      `
        UPDATE users
        SET email = $1
        WHERE id = $2
        RETURNING id, name, email, role
      `,
      [normalizedEmail, currentUser.id]
    );
    const user = result.rows[0];

    return res.status(200).json({
      token: signUserToken(user),
      user,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error("[IDENTITY] Profile email update failed:", error);
    return res.status(500).json({ message: "Failed to update email" });
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
