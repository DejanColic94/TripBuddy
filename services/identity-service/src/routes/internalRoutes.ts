import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { Router } from "express";
import type { DatabaseError, PoolClient } from "pg";
import pool from "../db";
import internalServiceAuthMiddleware from "../middleware/internalServiceAuthMiddleware";
import { sendTemporaryCredentialsEmail } from "../services/emailService";

type UserLookupRow = {
  id: number;
  name: string;
  email: string;
  role: string;
};

const router = Router();

router.use(internalServiceAuthMiddleware);

class CredentialsEmailDeliveryError extends Error {
  constructor(public readonly originalError: unknown) {
    super("Failed to send temporary credentials email");
  }
}

const uppercaseCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercaseCharacters = "abcdefghijklmnopqrstuvwxyz";
const numberCharacters = "0123456789";
const symbolCharacters = "!@#$%^&*()-_=+[]{}";
const passwordCharacters =
  uppercaseCharacters + lowercaseCharacters + numberCharacters + symbolCharacters;

function getRandomCharacter(characters: string): string {
  return characters[randomInt(0, characters.length)];
}

function shuffleCharacters(characters: string[]): string[] {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(0, index + 1);
    [characters[index], characters[randomIndex]] = [
      characters[randomIndex],
      characters[index],
    ];
  }

  return characters;
}

function generateTemporaryPassword(): string {
  const characters = [
    getRandomCharacter(uppercaseCharacters),
    getRandomCharacter(lowercaseCharacters),
    getRandomCharacter(numberCharacters),
    getRandomCharacter(symbolCharacters),
  ];

  while (characters.length < 20) {
    characters.push(getRandomCharacter(passwordCharacters));
  }

  return shuffleCharacters(characters).join("");
}

function deriveDisplayName(normalizedEmail: string): string {
  const localPart = normalizedEmail.split("@")[0] ?? "";
  const readableName = localPart
    .replace(/[._+-]+/g, " ")
    .replace(/[^a-z0-9 ]+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);

  if (!readableName || !/[a-z0-9]/i.test(readableName)) {
    return "TripBuddy Traveler";
  }

  return readableName.replace(/\b\w/g, (character) => character.toUpperCase());
}

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
  const { email } = req.body;

  if (typeof email !== "string" || email.trim().length === 0) {
    return res.status(400).json({ error: "email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const displayName = deriveDisplayName(normalizedEmail);
  const temporaryPassword = generateTemporaryPassword();
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

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const userResult = await client.query<UserLookupRow>(
      `
        INSERT INTO users (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, role
      `,
      [displayName, normalizedEmail, hashedPassword]
    );
    const user = userResult.rows[0];

    try {
      await sendTemporaryCredentialsEmail({
        recipientEmail: normalizedEmail,
        displayName,
        temporaryPassword,
      });
    } catch (error) {
      throw new CredentialsEmailDeliveryError(error);
    }

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

    if (error instanceof CredentialsEmailDeliveryError) {
      console.error(
        "[IDENTITY] Failed to send temporary credentials email:",
        error.originalError
      );
      return res
        .status(502)
        .json({ error: "Failed to send temporary credentials email" });
    }

    console.error("[IDENTITY] Failed to create invited user:", error);
    return res.status(500).json({ error: "Failed to create invited user" });
  } finally {
    client?.release();
  }
});

export default router;
