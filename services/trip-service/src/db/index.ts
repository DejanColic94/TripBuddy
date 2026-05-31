import { Pool } from "pg";

const pool = new Pool({
  host: process.env.TRIP_DB_HOST,
  port: Number(process.env.TRIP_DB_PORT) || 5432,
  database: process.env.TRIP_DB_NAME,
  user: process.env.TRIP_DB_USER,
  password: process.env.TRIP_DB_PASSWORD,
});

pool.on("error", (error) => {
  console.error("[DB] Unexpected pool error:", error);
});

export async function testConnection(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    console.log("[DB] Connected to trip database successfully");
  } catch (error) {
    console.error("[DB] Failed to connect to trip database:", error);
  }
}

export async function initDb(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[DB] Trips table ensured");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS itinerary_items (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        scheduled_date DATE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[DB] Itinerary items table ensured");
  } catch (error) {
    console.error("[DB] Failed to initialize trip database:", error);
  }
}

export default pool;