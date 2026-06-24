import { Router, type Request, type Response } from "express";
import { randomBytes } from "crypto";
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
  created_at: string;
};

type TripParticipantSummary = {
  userId: number;
  role: string;
};

type TripWithParticipantsRow = TripRow & {
  participants: TripParticipantSummary[];
};

type CreateTripBody = {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
};

type TripParticipantRow = {
  id: number;
  trip_id: number;
  user_id: number;
  role: string;
  created_at: string;
};

type AddTripParticipantBody = {
  userId?: number;
  role?: string;
};

type TripInviteRow = {
  id: number;
  trip_id: number;
  email: string;
  token: string;
  role: string;
  accepted_at: string | null;
  created_at: string;
};

type CreateTripInviteBody = {
  email?: string;
  role?: string;
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

type TripSummaryRow = {
  itinerary_count: string;
  expense_count: string;
  total_expenses: string | null;
  trip_duration_days: number | null;
};

const router = Router();

router.use(authMiddleware);

function mapTrip(trip: TripRow, participants: TripParticipantSummary[] = []) {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    startDate: trip.start_date,
    endDate: trip.end_date,
    createdBy: trip.created_by,
    createdAt: trip.created_at,
    start_date: trip.start_date,
    end_date: trip.end_date,
    created_by: trip.created_by,
    created_at: trip.created_at,
    participants,
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

function mapTripParticipant(participant: TripParticipantRow) {
  return {
    id: participant.id,
    tripId: participant.trip_id,
    userId: participant.user_id,
    role: participant.role,
    createdAt: participant.created_at,
  };
}

function mapTripInvite(invite: TripInviteRow) {
  return {
    id: invite.id,
    tripId: invite.trip_id,
    email: invite.email,
    token: invite.token,
    role: invite.role,
    acceptedAt: invite.accepted_at,
    createdAt: invite.created_at,
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

async function userOwnsTrip(tripId: number, userId: number): Promise<boolean> {
  const result = await pool.query<{ id: number }>(
    "SELECT id FROM trips WHERE id = $1 AND created_by = $2",
    [tripId, userId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

async function userCanAccessTrip(tripId: number, userId: number): Promise<boolean> {
  const result = await pool.query<{ id: number }>(
    `
      SELECT trips.id
      FROM trips
      LEFT JOIN trip_participants
        ON trip_participants.trip_id = trips.id
        AND trip_participants.user_id = $2
      WHERE trips.id = $1
        AND (trips.created_by = $2 OR trip_participants.id IS NOT NULL)
    `,
    [tripId, userId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

function generateInviteToken() {
  return randomBytes(32).toString("hex");
}

router.get("/", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await pool.query<TripWithParticipantsRow>(
      `
        WITH visible_trips AS (
          SELECT DISTINCT trips.id, trips.name, trips.description, trips.start_date, trips.end_date,
            trips.created_by, trips.created_at
          FROM trips
          LEFT JOIN trip_participants current_user_participants
            ON current_user_participants.trip_id = trips.id
            AND current_user_participants.user_id = $1
          WHERE trips.created_by = $1
            OR current_user_participants.id IS NOT NULL
        )
        SELECT visible_trips.id, visible_trips.name, visible_trips.description,
          visible_trips.start_date, visible_trips.end_date, visible_trips.created_by,
          visible_trips.created_at,
          COALESCE(
            json_agg(
              json_build_object('userId', trip_participants.user_id, 'role', trip_participants.role)
              ORDER BY trip_participants.created_at ASC
            ) FILTER (WHERE trip_participants.id IS NOT NULL),
            '[]'
          ) AS participants
        FROM visible_trips
        LEFT JOIN trip_participants
          ON trip_participants.trip_id = visible_trips.id
        GROUP BY visible_trips.id, visible_trips.name, visible_trips.description,
          visible_trips.start_date, visible_trips.end_date, visible_trips.created_by,
          visible_trips.created_at
        ORDER BY visible_trips.created_at DESC
      `,
      [req.user.id]
    );

    return res.status(200).json(
      result.rows.map((trip) => mapTrip(trip, trip.participants))
    );
  } catch (error) {
    console.error("[TRIPS] Failed to get trips:", error);
    return res.status(500).json({ error: "Failed to get trips" });
  }
});

router.post(
  "/invites/:token/accept",
  async (req: Request<{ token: string }>, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { token } = req.params;

    try {
      const inviteResult = await pool.query<TripInviteRow>(
        `
          SELECT id, trip_id, email, token, role, accepted_at, created_at
          FROM trip_invites
          WHERE token = $1
        `,
        [token]
      );

      if (inviteResult.rowCount === 0) {
        return res.status(404).json({ error: "Invite not found" });
      }

      const invite = inviteResult.rows[0];

      if (invite.accepted_at) {
        return res.status(409).json({ error: "Invite already accepted" });
      }

      await pool.query(
        `
          INSERT INTO trip_participants (trip_id, user_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT (trip_id, user_id) DO NOTHING
        `,
        [invite.trip_id, req.user.id, invite.role]
      );

      const acceptedInviteResult = await pool.query<TripInviteRow>(
        `
          UPDATE trip_invites
          SET accepted_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, trip_id, email, token, role, accepted_at, created_at
        `,
        [invite.id]
      );

      return res.status(200).json(mapTripInvite(acceptedInviteResult.rows[0]));
    } catch (error) {
      console.error("[TRIPS] Failed to accept trip invite:", error);
      return res.status(500).json({ error: "Failed to accept trip invite" });
    }
  }
);

router.get("/:id", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.id);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    if (!(await userCanAccessTrip(tripId, req.user.id))) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const result = await pool.query<TripWithParticipantsRow>(
      `
        SELECT trips.id, trips.name, trips.description, trips.start_date, trips.end_date,
          trips.created_by, trips.created_at,
          COALESCE(
            json_agg(
              json_build_object('userId', trip_participants.user_id, 'role', trip_participants.role)
              ORDER BY trip_participants.created_at ASC
            ) FILTER (WHERE trip_participants.id IS NOT NULL),
            '[]'
          ) AS participants
        FROM trips
        LEFT JOIN trip_participants
          ON trip_participants.trip_id = trips.id
        WHERE trips.id = $1
        GROUP BY trips.id, trips.name, trips.description, trips.start_date, trips.end_date,
          trips.created_by, trips.created_at
      `,
      [tripId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const trip = result.rows[0];

    return res.status(200).json(mapTrip(trip, trip.participants));
  } catch (error) {
    console.error("[TRIPS] Failed to get trip:", error);
    return res.status(500).json({ error: "Failed to get trip" });
  }
});

router.get("/:id/invites", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.id);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    if (!(await userOwnsTrip(tripId, req.user.id))) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const result = await pool.query<TripInviteRow>(
      `
        SELECT id, trip_id, email, token, role, accepted_at, created_at
        FROM trip_invites
        WHERE trip_id = $1
        ORDER BY created_at DESC
      `,
      [tripId]
    );

    return res.status(200).json(result.rows.map(mapTripInvite));
  } catch (error) {
    console.error("[TRIPS] Failed to get trip invites:", error);
    return res.status(500).json({ error: "Failed to get trip invites" });
  }
});

router.post(
  "/:id/invites",
  async (req: Request<{ id: string }, {}, CreateTripInviteBody>, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tripId = Number(req.params.id);
    const { email, role } = req.body;

    if (!Number.isInteger(tripId)) {
      return res.status(400).json({ error: "Invalid trip id" });
    }

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ error: "email is required" });
    }

    if (role !== undefined && role !== "viewer") {
      return res.status(400).json({ error: "role must be viewer" });
    }

    try {
      if (!(await userOwnsTrip(tripId, req.user.id))) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const result = await pool.query<TripInviteRow>(
        `
          INSERT INTO trip_invites (trip_id, email, token, role)
          VALUES ($1, $2, $3, $4)
          RETURNING id, trip_id, email, token, role, accepted_at, created_at
        `,
        [tripId, email.trim().toLowerCase(), generateInviteToken(), role ?? "viewer"]
      );

      return res.status(201).json(mapTripInvite(result.rows[0]));
    } catch (error) {
      console.error("[TRIPS] Failed to create trip invite:", error);
      return res.status(500).json({ error: "Failed to create trip invite" });
    }
  }
);

router.get("/:id/participants", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.id);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    if (!(await userCanAccessTrip(tripId, req.user.id))) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const result = await pool.query<TripParticipantRow>(
      `
        SELECT id, trip_id, user_id, role, created_at
        FROM trip_participants
        WHERE trip_id = $1
        ORDER BY created_at ASC
      `,
      [tripId]
    );

    return res.status(200).json(result.rows.map(mapTripParticipant));
  } catch (error) {
    console.error("[TRIPS] Failed to get trip participants:", error);
    return res.status(500).json({ error: "Failed to get trip participants" });
  }
});

router.post(
  "/:id/participants",
  async (req: Request<{ id: string }, {}, AddTripParticipantBody>, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tripId = Number(req.params.id);
    const { userId, role } = req.body;

    if (!Number.isInteger(tripId)) {
      return res.status(400).json({ error: "Invalid trip id" });
    }

    if (typeof userId !== "number" || !Number.isInteger(userId)) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (role !== undefined && role !== "viewer") {
      return res.status(400).json({ error: "role must be viewer" });
    }

    try {
      if (!(await userOwnsTrip(tripId, req.user.id))) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const result = await pool.query<TripParticipantRow>(
        `
          INSERT INTO trip_participants (trip_id, user_id, role)
          VALUES ($1, $2, $3)
          RETURNING id, trip_id, user_id, role, created_at
        `,
        [tripId, userId, role ?? "viewer"]
      );

      return res.status(201).json(mapTripParticipant(result.rows[0]));
    } catch (error) {
      const dbError = error as DatabaseError;

      if (dbError.code === "23505") {
        return res.status(409).json({ error: "Participant already exists" });
      }

      console.error("[TRIPS] Failed to add trip participant:", error);
      return res.status(500).json({ error: "Failed to add trip participant" });
    }
  }
);

router.get("/:tripId/summary", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.tripId);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    if (!(await userCanAccessTrip(tripId, req.user.id))) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const result = await pool.query<TripSummaryRow>(
      `
        SELECT
          (SELECT COUNT(*) FROM itinerary_items WHERE trip_id = trips.id) AS itinerary_count,
          (SELECT COUNT(*) FROM expenses WHERE trip_id = trips.id) AS expense_count,
          (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE trip_id = trips.id) AS total_expenses,
          CASE
            WHEN start_date IS NULL OR end_date IS NULL THEN 0
            ELSE end_date - start_date
          END AS trip_duration_days
        FROM trips
        WHERE id = $1
      `,
      [tripId]
    );

    const summary = result.rows[0];

    return res.status(200).json({
      itineraryCount: Number(summary.itinerary_count),
      expenseCount: Number(summary.expense_count),
      totalExpenses: Number(summary.total_expenses ?? 0),
      tripDurationDays: summary.trip_duration_days ?? 0,
    });
  } catch (error) {
    console.error("[TRIPS] Failed to get trip summary:", error);
    return res.status(500).json({ error: "Failed to get trip summary" });
  }
});

router.get("/:tripId/expenses", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.tripId);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    if (!(await userCanAccessTrip(tripId, req.user.id))) {
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
      return res.status(400).json({ error: "Invalid trip id" });
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
      if (!(await userOwnsTrip(tripId, req.user.id))) {
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
    return res.status(400).json({ error: "Invalid trip id" });
  }

  try {
    if (!(await userCanAccessTrip(tripId, req.user.id))) {
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
      return res.status(400).json({ error: "Invalid trip id" });
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
      if (!(await userOwnsTrip(tripId, req.user.id))) {
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
        RETURNING id, name, description, start_date, end_date, created_by, created_at
      `,
      [name.trim(), description ?? null, startDate ?? null, endDate ?? null, req.user.id]
    );

    await pool.query(
      `
        INSERT INTO trip_participants (trip_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (trip_id, user_id) DO NOTHING
      `,
      [result.rows[0].id, req.user.id, "owner"]
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
