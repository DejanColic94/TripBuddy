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
    throw error;
  }
}

export async function initDb(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        destination VARCHAR(255),
        destination_place_id INTEGER,
        destination_latitude DOUBLE PRECISION,
        destination_longitude DOUBLE PRECISION,
        destination_timezone VARCHAR(100),
        destination_country_code CHAR(2),
        start_date DATE,
        end_date DATE,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      ALTER TABLE trips
      ADD COLUMN IF NOT EXISTS destination VARCHAR(255)
    `);
    await pool.query(`
      ALTER TABLE trips
        ADD COLUMN IF NOT EXISTS destination_place_id INTEGER,
        ADD COLUMN IF NOT EXISTS destination_latitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS destination_longitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS destination_timezone VARCHAR(100),
        ADD COLUMN IF NOT EXISTS destination_country_code CHAR(2)
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS trips_created_by_lower_name_key
      ON trips (created_by, LOWER(name))
    `);
    console.log("[DB] Trips table ensured");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_participants (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user'
          CHECK (role IN ('admin', 'user', 'guest')),
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
        inviter_name VARCHAR(255),
        invited_by_user_id INTEGER,
        accepted_by_user_id INTEGER,
        role VARCHAR(50) NOT NULL DEFAULT 'user'
          CHECK (role IN ('admin', 'user', 'guest')),
        accepted_at TIMESTAMP NULL,
        expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      ALTER TABLE trip_invites
      ADD COLUMN IF NOT EXISTS inviter_name VARCHAR(255)
    `);
    await pool.query(`
      ALTER TABLE trip_invites
      ADD COLUMN IF NOT EXISTS invited_by_user_id INTEGER
    `);
    await pool.query(`
      ALTER TABLE trip_invites
      ADD COLUMN IF NOT EXISTS accepted_by_user_id INTEGER
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_contacts (
        id SERIAL PRIMARY KEY,
        user_one_id INTEGER NOT NULL,
        user_two_id INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT trip_contacts_distinct_users CHECK (user_one_id < user_two_id),
        CONSTRAINT trip_contacts_unique_pair UNIQUE (user_one_id, user_two_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS trip_contacts_user_two_id_idx
      ON trip_contacts (user_two_id)
    `);
    console.log("[DB] Trip contacts table ensured");
    await pool.query(`
      ALTER TABLE trip_invites
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
    `);
    await pool.query(`
      UPDATE trip_invites
      SET expires_at = created_at + INTERVAL '7 days'
      WHERE expires_at IS NULL
    `);
    await pool.query(`
      ALTER TABLE trip_invites
      ALTER COLUMN expires_at SET NOT NULL
    `);
    console.log("[DB] Trip invites table ensured");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_guest_access (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        invite_id INTEGER NOT NULL UNIQUE REFERENCES trip_invites(id) ON DELETE CASCADE,
        display_name VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[DB] Trip guest access table ensured");

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
    throw error;
  }
}

export default pool;
