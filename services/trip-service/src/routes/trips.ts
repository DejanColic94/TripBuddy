import { Router, type Request, type Response } from "express";
import { createHash, randomBytes } from "crypto";
import type { DatabaseError, PoolClient } from "pg";
import {
  createInvitedUser,
  getUserByEmail,
  getUserNames,
  IdentityClientError,
} from "../clients/identityClient";
import pool from "../db";
import authMiddleware, { optionalAuthMiddleware } from "../middleware/auth";
import { sendInvitationEmail } from "../services/emailService";

type TripRow = {
  id: number;
  name: string;
  description: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: number;
  created_at: string;
};

type TripParticipantSummary = {
  userId: number;
  role: string;
  name?: string;
};

type TripWithParticipantsRow = TripRow & {
  participants: TripParticipantSummary[];
};

type CreateTripBody = {
  name?: string;
  description?: string;
  destination?: string;
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
  expires_at?: string;
  created_at: string;
};

type TripInvitePreviewRow = TripInviteRow & {
  trip_name: string;
};

type OwnedTripInviteRow = {
  id: number;
  name: string;
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

type TripDateRangeRow = {
  scheduled_date_in_range: boolean;
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
const supportedCurrencies = new Set([
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "RSD",
  "CAD",
  "AUD",
  "JPY",
]);

class InviteEmailDeliveryError extends Error {
  constructor(public readonly originalError: unknown) {
    super("Failed to send invitation email");
  }
}

async function rollbackTransaction(client: PoolClient) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("[TRIPS] Failed to rollback transaction:", rollbackError);
  }
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function mapTrip(trip: TripRow, participants: TripParticipantSummary[] = []) {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    destination: trip.destination,
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

function mapTripParticipant(participant: TripParticipantRow, name?: string) {
  return {
    id: participant.id,
    tripId: participant.trip_id,
    userId: participant.user_id,
    name,
    role: participant.role,
    createdAt: participant.created_at,
  };
}

async function addParticipantNames<T extends TripParticipantSummary>(
  participants: T[],
  authorization?: string
) {
  const names = await getUserNames(
    participants.map((participant) => participant.userId),
    authorization
  );

  return participants.map((participant) => ({
    ...participant,
    name: names.get(participant.userId),
  }));
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

async function getTripOwnerId(tripId: number): Promise<number | null> {
  const result = await pool.query<{ created_by: number }>(
    "SELECT created_by FROM trips WHERE id = $1",
    [tripId]
  );

  return result.rows[0]?.created_by ?? null;
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

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

router.get(
  "/invites/:token",
  async (req: Request<{ token: string }>, res: Response) => {
    const token = req.params.token?.trim();

    if (!token) {
      return res.status(400).json({ error: "Invite token is required" });
    }

    try {
      const result = await pool.query<TripInvitePreviewRow>(
        `
          SELECT trip_invites.id, trip_invites.trip_id, trip_invites.email,
            trip_invites.token, trip_invites.role, trip_invites.accepted_at,
            trip_invites.expires_at, trip_invites.created_at,
            trips.name AS trip_name
          FROM trip_invites
          JOIN trips ON trips.id = trip_invites.trip_id
          WHERE trip_invites.token = $1
        `,
        [token]
      );
      const invite = result.rows[0];

      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (invite.accepted_at) {
        return res.status(409).json({ error: "Invite already accepted" });
      }

      if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
        return res.status(410).json({ error: "Invite has expired" });
      }

      const existingUser = await getUserByEmail(invite.email.trim().toLowerCase());

      return res.status(200).json({
        tripId: invite.trip_id,
        tripName: invite.trip_name,
        email: invite.email,
        role: invite.role,
        accountExists: Boolean(existingUser),
        expiresAt: invite.expires_at,
      });
    } catch (error) {
      if (error instanceof IdentityClientError) {
        console.error("[TRIPS] Failed to inspect invited account:", error);
        return res.status(502).json({ error: "Failed to inspect invitation" });
      }

      console.error("[TRIPS] Failed to load trip invite:", error);
      return res.status(500).json({ error: "Failed to load trip invite" });
    }
  }
);

router.post(
  "/invites/:token/guest",
  async (
    req: Request<{ token: string }, {}, { displayName?: unknown }>,
    res: Response
  ) => {
    const token = req.params.token?.trim();
    const displayName =
      typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";

    if (!token) return res.status(400).json({ error: "Invite token is required" });
    if (!displayName) return res.status(400).json({ error: "Display name is required" });
    if (displayName.length > 255) {
      return res.status(400).json({ error: "Display name must be 255 characters or fewer" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<TripInviteRow>(
        `SELECT id, trip_id, email, token, role, accepted_at, expires_at, created_at
         FROM trip_invites WHERE token = $1 FOR UPDATE`,
        [token]
      );
      const invite = result.rows[0];

      if (!invite) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Invite not found" });
      }
      if (invite.accepted_at) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Invite already accepted" });
      }
      if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
        await client.query("ROLLBACK");
        return res.status(410).json({ error: "Invite has expired" });
      }

      const guestToken = randomBytes(32).toString("hex");
      await client.query(
        `INSERT INTO trip_guest_access
          (trip_id, invite_id, display_name, token_hash)
         VALUES ($1, $2, $3, $4)`,
        [invite.trip_id, invite.id, displayName, hashGuestToken(guestToken)]
      );
      await client.query(
        "UPDATE trip_invites SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1",
        [invite.id]
      );
      await client.query("COMMIT");

      return res.status(201).json({
        tripId: invite.trip_id,
        displayName,
        guestToken,
        expiresInDays: 30,
      });
    } catch (error) {
      await rollbackTransaction(client);
      console.error("[TRIPS] Failed to create guest access:", error);
      return res.status(500).json({ error: "Failed to create guest access" });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/guests/:token/trip",
  async (req: Request<{ token: string }>, res: Response) => {
    const token = req.params.token?.trim();
    if (!token) return res.status(400).json({ error: "Guest token is required" });

    try {
      const accessResult = await pool.query<{
        trip_id: number;
        display_name: string;
        expires_at: string;
      }>(
        `SELECT trip_id, display_name, expires_at
         FROM trip_guest_access
         WHERE token_hash = $1 AND revoked_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP`,
        [hashGuestToken(token)]
      );
      const access = accessResult.rows[0];
      if (!access) {
        return res.status(404).json({ error: "Guest access is invalid or has expired" });
      }

      const [tripResult, itineraryResult, expensesResult] = await Promise.all([
        pool.query<TripRow>(
          `SELECT id, name, description, destination, start_date, end_date,
            created_by, created_at FROM trips WHERE id = $1`,
          [access.trip_id]
        ),
        pool.query<ItineraryItemRow>(
          `SELECT id, trip_id, title, description, scheduled_date, created_at
           FROM itinerary_items WHERE trip_id = $1 ORDER BY scheduled_date, created_at`,
          [access.trip_id]
        ),
        pool.query<ExpenseRow>(
          `SELECT id, trip_id, title, amount, currency, category, created_at
           FROM expenses WHERE trip_id = $1 ORDER BY created_at`,
          [access.trip_id]
        ),
      ]);
      const trip = tripResult.rows[0];
      if (!trip) return res.status(404).json({ error: "Trip not found" });

      return res.status(200).json({
        guest: { displayName: access.display_name, expiresAt: access.expires_at },
        trip: mapTrip(trip),
        itinerary: itineraryResult.rows.map(mapItineraryItem),
        expenses: expensesResult.rows.map(mapExpense),
        permissions: { readOnly: true },
      });
    } catch (error) {
      console.error("[TRIPS] Failed to load guest trip:", error);
      return res.status(500).json({ error: "Failed to load guest trip" });
    }
  }
);

router.post(
  "/invites/:token/accept",
  optionalAuthMiddleware,
  async (
    req: Request<{ token: string }, {}, { name?: unknown; password?: unknown }>,
    res: Response
  ) => {
    const { token } = req.params;

    if (typeof token !== "string" || token.trim().length === 0) {
      return res.status(400).json({ error: "Invite token is required" });
    }

    let client: PoolClient | undefined;
    let accountCreated = false;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const inviteResult = await client.query<TripInviteRow>(
        `
          SELECT id, trip_id, email, token, role, accepted_at, expires_at, created_at
          FROM trip_invites
          WHERE token = $1
          FOR UPDATE
        `,
        [token]
      );

      if (inviteResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Invite not found" });
      }

      const invite = inviteResult.rows[0];

      if (invite.accepted_at) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Invite already accepted" });
      }

      if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
        await client.query("ROLLBACK");
        return res.status(410).json({ error: "Invite has expired" });
      }

      const inviteEmail = invite.email.trim().toLowerCase();
      let participantUserId: number;

      if (req.user) {
        const authenticatedEmail = req.user.email?.trim().toLowerCase();

        if (!authenticatedEmail) {
          await client.query("ROLLBACK");
          return res
            .status(403)
            .json({ error: "Authenticated account email is unavailable" });
        }

        if (authenticatedEmail !== inviteEmail) {
          await client.query("ROLLBACK");
          return res
            .status(403)
            .json({ error: "Invite belongs to a different email" });
        }

        participantUserId = req.user.id;
      } else {
        let existingUser;

        try {
          existingUser = await getUserByEmail(inviteEmail);
        } catch (error) {
          console.error("getUserByEmail failed:", error);
          throw error;
        }

        if (existingUser) {
          await client.query("ROLLBACK");
          return res
            .status(401)
            .json({ error: "Login required for invited email" });
        }

        const name =
          typeof req.body?.name === "string" ? req.body.name.trim() : "";
        const password =
          typeof req.body?.password === "string" ? req.body.password : "";

        if (!name) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Name is required" });
        }

        if (name.length > 255) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Name must be 255 characters or fewer" });
        }

        if (password.length < 8) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Password must be at least 8 characters" });
        }

        if (Buffer.byteLength(password, "utf8") > 72) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Password must be 72 bytes or fewer" });
        }

        try {
          // Identity user creation cannot be part of this Postgres transaction.
          // If later Trip DB writes fail, the new account may remain while the invite stays unaccepted.
          const invitedUserResult = await createInvitedUser(
            inviteEmail,
            name,
            password
          );

          if (!invitedUserResult.created) {
            await client.query("ROLLBACK");
            return res
              .status(401)
              .json({ error: "Login required for invited email" });
          }

          participantUserId = invitedUserResult.user.id;
          accountCreated = true;
        } catch (error) {
            console.error("createInvitedUser failed:", error);
            throw error;
        }
      }

      await client.query(
        `
          INSERT INTO trip_participants (trip_id, user_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT (trip_id, user_id)
          DO UPDATE SET role = EXCLUDED.role
        `,
        [invite.trip_id, participantUserId, invite.role]
      );

      const acceptedInviteResult = await client.query<TripInviteRow>(
        `
          UPDATE trip_invites
          SET accepted_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, trip_id, email, token, role, accepted_at, created_at
        `,
        [invite.id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        ...mapTripInvite(acceptedInviteResult.rows[0]),
        accountCreated,
      });
    } catch (error) {
      if (client) {
        await rollbackTransaction(client);
      }

      if (error instanceof IdentityClientError) {
        console.error("[TRIPS] Failed to process invited account:", error);
        return res.status(502).json({ error: "Failed to process invited account" });
      }

      console.error("[TRIPS] Failed to accept trip invite:", error);
      return res.status(500).json({ error: "Failed to accept trip invite" });
    } finally {
      client?.release();
    }
  }
);

router.use(authMiddleware);

router.delete(
  "/:tripId/guests/:guestId",
  async (
    req: Request<{ tripId: string; guestId: string }>,
    res: Response
  ) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const tripId = Number(req.params.tripId);
    const guestId = Number(req.params.guestId);
    if (!Number.isInteger(tripId) || !Number.isInteger(guestId)) {
      return res.status(400).json({ error: "Invalid guest access id" });
    }

    try {
      if (!(await userOwnsTrip(tripId, req.user.id))) {
        return res.status(404).json({ error: "Trip not found" });
      }
      const result = await pool.query(
        `UPDATE trip_guest_access
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND trip_id = $2 AND revoked_at IS NULL
         RETURNING id`,
        [guestId, tripId]
      );
      if (!result.rowCount) {
        return res.status(404).json({ error: "Guest access not found" });
      }
      return res.status(204).send();
    } catch (error) {
      console.error("[TRIPS] Failed to revoke guest access:", error);
      return res.status(500).json({ error: "Failed to revoke guest access" });
    }
  }
);

router.get("/", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await pool.query<TripWithParticipantsRow>(
      `
        WITH visible_trips AS (
          SELECT DISTINCT trips.id, trips.name, trips.description, trips.destination,
            trips.start_date, trips.end_date,
            trips.created_by, trips.created_at
          FROM trips
          LEFT JOIN trip_participants current_user_participants
            ON current_user_participants.trip_id = trips.id
            AND current_user_participants.user_id = $1
          WHERE trips.created_by = $1
            OR current_user_participants.id IS NOT NULL
        )
        SELECT visible_trips.id, visible_trips.name, visible_trips.description,
          visible_trips.destination,
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
          visible_trips.destination,
          visible_trips.start_date, visible_trips.end_date, visible_trips.created_by,
          visible_trips.created_at
        ORDER BY visible_trips.created_at DESC
      `,
      [req.user.id]
    );

    const participantNames = await getUserNames(
      result.rows.flatMap((trip) =>
        trip.participants.map((participant) => participant.userId)
      ),
      req.headers.authorization
    );

    return res.status(200).json(
      result.rows.map((trip) =>
        mapTrip(
          trip,
          trip.participants.map((participant) => ({
            ...participant,
            name: participantNames.get(participant.userId),
          }))
        )
      )
    );
  } catch (error) {
    console.error("[TRIPS] Failed to get trips:", error);
    return res.status(500).json({ error: "Failed to get trips" });
  }
});

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
        SELECT trips.id, trips.name, trips.description, trips.destination,
          trips.start_date, trips.end_date,
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
        GROUP BY trips.id, trips.name, trips.description, trips.destination,
          trips.start_date, trips.end_date,
          trips.created_by, trips.created_at
      `,
      [tripId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const trip = result.rows[0];

    const participants = await addParticipantNames(
      trip.participants,
      req.headers.authorization
    );

    return res.status(200).json(mapTrip(trip, participants));
  } catch (error) {
    console.error("[TRIPS] Failed to get trip:", error);
    return res.status(500).json({ error: "Failed to get trip" });
  }
});

router.put(
  "/:id",
  async (req: Request<{ id: string }, {}, CreateTripBody>, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tripId = Number(req.params.id);
    const { name, description, destination, startDate, endDate } = req.body;

    if (!Number.isInteger(tripId)) {
      return res.status(400).json({ error: "Invalid trip id" });
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "name is required" });
    }

    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({ error: "description must be a string" });
    }

    if (destination !== undefined && typeof destination !== "string") {
      return res.status(400).json({ error: "destination must be a string" });
    }

    if (startDate !== undefined && typeof startDate !== "string") {
      return res.status(400).json({ error: "startDate must be a string" });
    }

    if (endDate !== undefined && typeof endDate !== "string") {
      return res.status(400).json({ error: "endDate must be a string" });
    }

    try {
      const ownerId = await getTripOwnerId(tripId);

      if (ownerId === null) {
        return res.status(404).json({ error: "Trip not found" });
      }

      if (ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await pool.query<TripRow>(
        `
          UPDATE trips
          SET name = $1, description = $2, destination = $3, start_date = $4, end_date = $5
          WHERE id = $6
          RETURNING id, name, description, destination, start_date, end_date, created_by, created_at
        `,
        [
          name.trim(),
          description?.trim() || null,
          destination?.trim() || null,
          startDate || null,
          endDate || null,
          tripId,
        ]
      );

      return res.status(200).json(mapTrip(result.rows[0]));
    } catch (error) {
      const dbError = error as DatabaseError;

      if (dbError.code === "22007") {
        return res.status(400).json({ error: "startDate and endDate must be valid dates" });
      }

      console.error("[TRIPS] Failed to update trip:", error);
      return res.status(500).json({ error: "Failed to update trip" });
    }
  }
);

router.delete("/:id", async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tripId = Number(req.params.id);

  if (!Number.isInteger(tripId)) {
    return res.status(400).json({ error: "Invalid trip id" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const tripResult = await client.query<{ created_by: number }>(
      "SELECT created_by FROM trips WHERE id = $1 FOR UPDATE",
      [tripId]
    );
    const ownerId = tripResult.rows[0]?.created_by;

    if (ownerId === undefined) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Trip not found" });
    }

    if (ownerId !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    await client.query("DELETE FROM trip_invites WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM expenses WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM itinerary_items WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM trip_participants WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM trips WHERE id = $1", [tripId]);
    await client.query("COMMIT");

    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[TRIPS] Failed to delete trip:", error);
    return res.status(500).json({ error: "Failed to delete trip" });
  } finally {
    client.release();
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

    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (normalizedEmail.length > 255 || !emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ error: "email must be valid" });
    }

    if (role !== undefined && role !== "viewer") {
      return res.status(400).json({ error: "role must be viewer" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const tripResult = await client.query<OwnedTripInviteRow>(
        "SELECT id, name FROM trips WHERE id = $1 AND created_by = $2 FOR UPDATE",
        [tripId, req.user.id]
      );
      const trip = tripResult.rows[0];

      if (!trip) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Trip not found" });
      }

      const inviteToken = generateInviteToken();
      const inviteRole = role ?? "viewer";

      const result = await client.query<TripInviteRow>(
        `
          INSERT INTO trip_invites (trip_id, email, token, role)
          VALUES ($1, $2, $3, $4)
          RETURNING id, trip_id, email, token, role, accepted_at, created_at
        `,
        [tripId, normalizedEmail, inviteToken, inviteRole]
      );

      try {
        await sendInvitationEmail({
          recipientEmail: normalizedEmail,
          inviterName: req.user.name ?? "A TripBuddy user",
          tripName: trip.name,
          inviteToken,
        });
      } catch (error) {
        throw new InviteEmailDeliveryError(error);
      }

      await client.query("COMMIT");

      return res.status(201).json(mapTripInvite(result.rows[0]));
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[TRIPS] Failed to rollback trip invite transaction:",
          rollbackError
        );
      }

      if (error instanceof InviteEmailDeliveryError) {
        console.error(
          "[TRIPS] Failed to send trip invite email:",
          error.originalError
        );
        return res
          .status(502)
          .json({ error: "Failed to send invitation email" });
      }

      console.error("[TRIPS] Failed to create trip invite:", error);
      return res.status(500).json({ error: "Failed to create trip invite" });
    } finally {
      client.release();
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

    const participants = result.rows.map((participant) =>
      mapTripParticipant(participant)
    );
    const namedParticipants = await addParticipantNames(
      participants,
      req.headers.authorization
    );

    return res.status(200).json(namedParticipants);
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

      const names = await getUserNames([userId], req.headers.authorization);

      return res.status(201).json(
        mapTripParticipant(result.rows[0], names.get(userId))
      );
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

    const normalizedCurrency = currency?.trim().toUpperCase() || "EUR";
    if (!supportedCurrencies.has(normalizedCurrency)) {
      return res.status(400).json({
        error: `currency must be one of: ${Array.from(supportedCurrencies).join(", ")}`,
      });
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
          normalizedCurrency,
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

    if (scheduledDate !== undefined && !isValidDateOnly(scheduledDate)) {
      return res.status(400).json({ error: "scheduledDate must be a valid date" });
    }

    try {
      if (!(await userOwnsTrip(tripId, req.user.id))) {
        return res.status(404).json({ error: "Trip not found" });
      }

      if (scheduledDate !== undefined) {
        const tripResult = await pool.query<TripDateRangeRow>(
          `
            SELECT start_date IS NOT NULL
              AND end_date IS NOT NULL
              AND $2::date BETWEEN start_date AND end_date AS scheduled_date_in_range
            FROM trips
            WHERE id = $1
          `,
          [tripId, scheduledDate]
        );

        if (!tripResult.rows[0]?.scheduled_date_in_range) {
          return res.status(400).json({
            error: "scheduledDate must be within the trip date range",
          });
        }
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

  const { name, description, destination, startDate, endDate } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }

  if (description !== undefined && typeof description !== "string") {
    return res.status(400).json({ error: "description must be a string" });
  }

  if (destination !== undefined && typeof destination !== "string") {
    return res.status(400).json({ error: "destination must be a string" });
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
        INSERT INTO trips (name, description, destination, start_date, end_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, description, destination, start_date, end_date, created_by, created_at
      `,
      [
        name.trim(),
        description?.trim() || null,
        destination?.trim() || null,
        startDate || null,
        endDate || null,
        req.user.id,
      ]
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
