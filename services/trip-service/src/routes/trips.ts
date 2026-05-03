import { Router, type Request, type Response } from "express";
import type { DatabaseError } from "pg";
import pool from "../db";

type TripRow = {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: number;
};

type CreateTripBody = {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: number;
};

type GetTripsQuery = {
  userId?: string;
};

const router = Router();

function mapTrip(trip: TripRow) {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    startDate: trip.start_date,
    endDate: trip.end_date,
    createdBy: trip.created_by,
  };
}

router.get("/", async (req: Request<{}, {}, {}, GetTripsQuery>, res: Response) => {
  const { userId } = req.query;

  if (typeof userId !== "string" || userId.trim().length === 0) {
    return res.status(400).json({ error: "userId is required" });
  }

  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    return res.status(400).json({ error: "userId must be a number" });
  }

  try {
    const result = await pool.query<TripRow>(
      `
        SELECT id, name, description, start_date, end_date, created_by
        FROM trips
        WHERE created_by = $1
        ORDER BY created_at DESC
      `,
      [parsedUserId]
    );

    return res.status(200).json(result.rows.map(mapTrip));
  } catch (error) {
    console.error("[TRIPS] Failed to get trips:", error);
    return res.status(500).json({ error: "Failed to get trips" });
  }
});

router.post("/", async (req: Request<{}, {}, CreateTripBody>, res: Response) => {
  const { name, description, startDate, endDate, createdBy } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }

  if (typeof createdBy !== "number" || Number.isNaN(createdBy)) {
    return res.status(400).json({ error: "createdBy is required" });
  }

  if (description !== undefined && typeof description !== "string") {
    return res.status(400).json({ error: "description must be a string" });
  }

  if (startDate !== undefined && typeof startDate !== "string") {
    return res.status(400).json({ error: "startDate must be a string" });
  }

  if (endDate !== undefined && typeof endDate !== "string") {
    return res.status(400).json({ error: "endDate must be a string" });
  }

  try {
    const result = await pool.query<TripRow>(
      `
        INSERT INTO trips (name, description, start_date, end_date, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, start_date, end_date, created_by
      `,
      [name.trim(), description ?? null, startDate ?? null, endDate ?? null, createdBy]
    );

    return res.status(201).json(mapTrip(result.rows[0]));
  } catch (error) {
    const dbError = error as DatabaseError;

    if (dbError.code === "22007") {
      return res.status(400).json({ error: "startDate and endDate must be valid dates" });
    }

    console.error("[TRIPS] Failed to create trip:", error);
    return res.status(500).json({ error: "Failed to create trip" });
  }
});

export default router;
