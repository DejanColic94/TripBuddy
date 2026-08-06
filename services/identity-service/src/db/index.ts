import { Pool } from "pg";

const pool = new Pool({
  host: process.env.IDENTITY_DB_HOST,
  port: Number(process.env.IDENTITY_DB_PORT) || 5432,
  database: process.env.IDENTITY_DB_NAME,
  user: process.env.IDENTITY_DB_USER,
  password: process.env.IDENTITY_DB_PASSWORD,
});

pool.on("error", (error) => {
  console.error("[DB] Unexpected pool error:", error);
});

export async function testConnection(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    console.log("[DB] Connected to identity database successfully");
  } catch (error) {
    console.error("[DB] Failed to connect to identity database:", error);
    throw error;
  }
}

export async function initDb(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name VARCHAR(255)
    `);
    await pool.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS pending_email
    `);
    await pool.query(`
      UPDATE users
      SET name = COALESCE(
        NULLIF(BTRIM(split_part(email, '@', 1)), ''),
        'Traveler ' || id::text
      )
      WHERE name IS NULL OR BTRIM(name) = ''
    `);
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN name SET NOT NULL
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
      ON users (LOWER(email))
    `);
    console.log("[DB] Users table ensured");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
      ON password_reset_tokens (user_id)
    `);
    console.log("[DB] Password reset tokens table ensured");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx
      ON email_verification_tokens (user_id)
    `);
    console.log("[DB] Email verification tokens table ensured");
  } catch (error) {
    console.error("[DB] Failed to initialize identity database:", error);
    throw error;
  }
}

export default pool;
