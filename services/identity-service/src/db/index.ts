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
  }
}

export async function initDb(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error("[DB] Failed to initialize identity database:", error);
  }
}

export default pool;
