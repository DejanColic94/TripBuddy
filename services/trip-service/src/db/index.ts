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
      CREATE TABLE IF NOT EXISTS trip_participants (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname IN (
            'trip_participants_trip_id_user_id_unique',
            'trip_participants_trip_id_user_id_key'
          )
        ) THEN
          ALTER TABLE trip_participants
          ADD CONSTRAINT trip_participants_trip_id_user_id_unique UNIQUE (trip_id, user_id);
        END IF;
      END $$;
    `);
    console.log("[DB] Trip participants table ensured");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_invites (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        accepted_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[DB] Trip invites table ensured");

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
        category VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[DB] Expenses table ensured");
  } catch (error) {
    console.error("[DB] Failed to initialize trip database:", error);
  }
}

export default pool;
