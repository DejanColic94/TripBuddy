import { Router, type Request, type Response } from "express";
import type { DatabaseError } from "pg";
import pool from "../db";
import authMiddleware from "../middleware/auth";

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
};

type ItineraryItemRow = {
  id: number;
  trip_id: number;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  created_at: string;
};

type CreateItineraryItemBody = {
  title?: string;
  description?: string;
  scheduledDate?: string;
};

type ExpenseRow = {
  id: number;
  trip_id: number;
  title: string;
  amount: string;
  currency: string;
  category: string | null;
  created_at: string;
};

type CreateExpenseBody = {
  title?: string;
  amount?: number;
  currency?: string;
  category?: string;
};

const router = Router();

router.use(authMiddleware);

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

function mapItineraryItem(item: ItineraryItemRow) {
  return {
    id: item.id,
    tripId: item.trip_id,
    title: item.title,
    description: item.description,
    scheduledDate: item.scheduled_date,
    createdAt: item.created_at,
  };
}

function mapExpense(expense: ExpenseRow) {
  return {
    id: expense.id,
    tripId: expense.trip_id,
    title: expense.title,
    amount: Number(expense.amount),
    currency: expense.currency,
    category: expense.category,
    createdAt: expense.created_at,
  };
}

router.get("/", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await pool.query<TripRow>(
      `
        SELECT id, name, description, start_date, end_date, created_by
        FROM trips
        WHERE created_by = $1
        ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    return res.status(200).json(result.rows.map(mapTrip));
  } catch (error) {
    console.error("[TRIPS] Failed to get trips:", error);
    return res.status(500).json({ error: "Failed to get trips" });
  }
});

router.get("/:tripId/expenses", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.tripId);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "tripId must be a number" });
  }

  try {
    const tripResult = await pool.query<{ id: number }>(
      "SELECT id FROM trips WHERE id = $1 AND created_by = $2",
      [tripId, req.user.id]
    );

    if (tripResult.rowCount === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const result = await pool.query<ExpenseRow>(
      `
        SELECT id, trip_id, title, amount, currency, category, created_at
        FROM expenses
        WHERE trip_id = $1
        ORDER BY created_at DESC
      `,
      [tripId]
    );

    return res.status(200).json(result.rows.map(mapExpense));
  } catch (error) {
    console.error("[TRIPS] Failed to get expenses:", error);
    return res.status(500).json({ error: "Failed to get expenses" });
  }
});

router.post(
  "/:tripId/expenses",
  async (req: Request<{ tripId: string }, {}, CreateExpenseBody>, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tripId = Number(req.params.tripId);
    const { title, amount, currency, category } = req.body;

    if (!Number.isInteger(tripId)) {
      return res.status(400).json({ error: "tripId must be a number" });
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "title is required" });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return res.status(400).json({ error: "amount is required" });
    }

    if (currency !== undefined && typeof currency !== "string") {
      return res.status(400).json({ error: "currency must be a string" });
    }

    if (category !== undefined && typeof category !== "string") {
      return res.status(400).json({ error: "category must be a string" });
    }

    try {
      const tripResult = await pool.query<{ id: number }>(
        "SELECT id FROM trips WHERE id = $1 AND created_by = $2",
        [tripId, req.user.id]
      );

      if (tripResult.rowCount === 0) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const result = await pool.query<ExpenseRow>(
        `
          INSERT INTO expenses (trip_id, title, amount, currency, category)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, trip_id, title, amount, currency, category, created_at
        `,
        [
          tripId,
          title.trim(),
          amount,
          currency?.trim() || "EUR",
          category?.trim() || null,
        ]
      );

      return res.status(201).json(mapExpense(result.rows[0]));
    } catch (error) {
      console.error("[TRIPS] Failed to create expense:", error);
      return res.status(500).json({ error: "Failed to create expense" });
    }
  }
);

router.get("/:tripId/itinerary", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.tripId);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "tripId must be a number" });
  }

  try {
    const tripResult = await pool.query<{ id: number }>(
      "SELECT id FROM trips WHERE id = $1 AND created_by = $2",
      [tripId, req.user.id]
    );

    if (tripResult.rowCount === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const result = await pool.query<ItineraryItemRow>(
      `
        SELECT id, trip_id, title, description, scheduled_date, created_at
        FROM itinerary_items
        WHERE trip_id = $1
        ORDER BY scheduled_date ASC NULLS LAST, created_at DESC
      `,
      [tripId]
    );

    return res.status(200).json(result.rows.map(mapItineraryItem));
  } catch (error) {
    console.error("[TRIPS] Failed to get itinerary items:", error);
    return res.status(500).json({ error: "Failed to get itinerary items" });
  }
});

router.post(
  "/:tripId/itinerary",
  async (req: Request<{ tripId: string }, {}, CreateItineraryItemBody>, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tripId = Number(req.params.tripId);
    const { title, description, scheduledDate } = req.body;

    if (!Number.isInteger(tripId)) {
      return res.status(400).json({ error: "tripId must be a number" });
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "title is required" });
    }

    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({ error: "description must be a string" });
    }

    if (scheduledDate !== undefined && typeof scheduledDate !== "string") {
      return res.status(400).json({ error: "scheduledDate must be a string" });
    }

    try {
      const tripResult = await pool.query<{ id: number }>(
        "SELECT id FROM trips WHERE id = $1 AND created_by = $2",
        [tripId, req.user.id]
      );

      if (tripResult.rowCount === 0) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const result = await pool.query<ItineraryItemRow>(
        `
          INSERT INTO itinerary_items (trip_id, title, description, scheduled_date)
          VALUES ($1, $2, $3, $4)
          RETURNING id, trip_id, title, description, scheduled_date, created_at
        `,
        [tripId, title.trim(), description ?? null, scheduledDate ?? null]
      );

      return res.status(201).json(mapItineraryItem(result.rows[0]));
    } catch (error) {
      const dbError = error as DatabaseError;

      if (dbError.code === "22007") {
        return res.status(400).json({ error: "scheduledDate must be a valid date" });
      }

      console.error("[TRIPS] Failed to create itinerary item:", error);
      return res.status(500).json({ error: "Failed to create itinerary item" });
    }
  }
);

router.post("/", async (req: Request<{}, {}, CreateTripBody>, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, description, startDate, endDate } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
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
      [name.trim(), description ?? null, startDate ?? null, endDate ?? null, req.user.id]
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