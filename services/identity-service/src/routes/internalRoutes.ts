import bcrypt from "bcrypt";
import { Router } from "express";
import type { DatabaseError, PoolClient } from "pg";
import pool from "../db";
import internalServiceAuthMiddleware from "../middleware/internalServiceAuthMiddleware";

type UserLookupRow = {
  id: number;
  name: string;
  email: string;
  role: string;
};

const router = Router();

router.use(internalServiceAuthMiddleware);

router.get("/users/by-ids", async (req, res) => {
  const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = Array.from(
    new Set(
      idsParam
        .split(",")
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );

  if (ids.length === 0) {
    return res.status(200).json([]);
  }

  if (ids.length > 100) {
    return res.status(400).json({ error: "A maximum of 100 user ids is allowed" });
  }

  try {
    const result = await pool.query<UserLookupRow>(
      "SELECT id, name, email, role FROM users WHERE id = ANY($1::int[]) ORDER BY name, id",
      [ids]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("[IDENTITY] Internal user id lookup failed:", error);
    return res.status(500).json({ error: "Failed to look up users" });
  }
});

async function rollbackTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error(
      "[IDENTITY] Failed to rollback invited user transaction:",
      rollbackError
    );
  }
}

router.get("/users/by-email", async (req, res) => {
  const email = req.query.email;

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ error: "email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query<UserLookupRow>(
      "SELECT id, name, email, role FROM users WHERE LOWER(email) = $1;",
      [normalizedEmail]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("[IDENTITY] Internal user email lookup failed:", error);
    return res.status(500).json({ error: "Failed to look up user" });
  }
});

router.post("/users/invited", async (req, res) => {
  const { email, name, password } = req.body;

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ error: "email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (normalizedEmail.length > 255 || !emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ error: "email must be valid" });
  }

  if (!normalizedName) {
    return res.status(400).json({ error: "name is required" });
  }

  if (normalizedName.length > 255) {
    return res.status(400).json({ error: "name must be 255 characters or fewer" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "password must be at least 8 characters" });
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return res
      .status(400)
      .json({ error: "password must be 72 bytes or fewer" });
  }

  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const existingUserResult = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE LOWER(email) = $1;",
      [normalizedEmail]
    );

    if (existingUserResult.rowCount && existingUserResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query<UserLookupRow>(
      `
        INSERT INTO users (name, email, password, email_verified)
        VALUES ($1, $2, $3, TRUE)
        RETURNING id, name, email, role
      `,
      [normalizedName, normalizedEmail, hashedPassword]
    );
    const user = userResult.rows[0];

    await client.query("COMMIT");

    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (client) {
      await rollbackTransaction(client);
    }

    const dbError = error as DatabaseError;

    if (dbError.code === "23505") {
      return res.status(409).json({ error: "User already exists" });
    }

    console.error("[IDENTITY] Failed to create invited user:", error);
    return res.status(500).json({ error: "Failed to create invited user" });
  } finally {
    client?.release();
  }
});

export default router;
