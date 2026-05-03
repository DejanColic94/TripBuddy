import { Router, type Request, type Response } from "express";
import type { DatabaseError } from "pg";
import pool from "../db";

type CreateTripBody = {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: number;
};

const router = Router();

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
    const result = await pool.query(
      `
        INSERT INTO trips (name, description, start_date, end_date, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, start_date, end_date, created_by
      `,
      [name.trim(), description ?? null, startDate ?? null, endDate ?? null, createdBy]
    );

    const trip = result.rows[0];

    return res.status(201).json({
      id: trip.id,
      name: trip.name,
      description: trip.description,
      startDate: trip.start_date,
      endDate: trip.end_date,
      createdBy: trip.created_by,
    });
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
