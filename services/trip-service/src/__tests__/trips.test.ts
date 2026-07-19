import jwt from "jsonwebtoken";
import request from "supertest";
import { sendInvitationEmail } from "../services/emailService";
import app from "../app";
import pool, { initDb } from "../db";

jest.mock("../services/emailService", () => ({
  sendInvitationEmail: jest.fn(),
}));

const userId = 987654;
const participantUserId = 987655;
const nonOwnerUserId = 987656;
const invitedCreatedUserId = 987657;
const raceRecoveredUserId = 987661;
const ownerEmail = "owner@example.com";
const participantEmail = "participant@example.com";
const invitedEmail = "invited@example.com";
const userNames = new Map([
  [userId, "Owner Traveler"],
  [participantUserId, "Shared Traveler"],
  [nonOwnerUserId, "Invited Traveler"],
  [invitedCreatedUserId, "Created Invitee"],
]);
const identityUsersByEmail = new Map([
  [
    invitedEmail,
    { id: nonOwnerUserId, name: "Invited Traveler", email: invitedEmail, role: "user" },
  ],
  [
    participantEmail,
    { id: participantUserId, name: "Shared Traveler", email: participantEmail, role: "user" },
  ],
]);
const sendInvitationEmailMock = sendInvitationEmail as jest.MockedFunction<
  typeof sendInvitationEmail
>;
let identityLookupEmails: string[] = [];
let identityCreateEmails: string[] = [];
let failIdentityLookup = false;
let failIdentityCreate = false;
const raceRecoveredEmail = "race-recovered@example.com";

async function cleanupTestData() {
  await pool.query(
    "DELETE FROM trip_invites WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)",
    [userId]
  );
  await pool.query(
    `
      DELETE FROM trip_participants
      WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)
        OR user_id IN ($1, $2, $3)
    `,
    [userId, participantUserId, nonOwnerUserId]
  );
  await pool.query("DELETE FROM expenses WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)", [
    userId,
  ]);
  await pool.query(
    "DELETE FROM itinerary_items WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)",
    [userId]
  );
  await pool.query("DELETE FROM trips WHERE created_by = $1", [userId]);
}

beforeAll(async () => {
  process.env.TRIP_JWT_SECRET ??= "test_identity_secret";
  process.env.IDENTITY_SERVICE_URL ??= "http://identity-service:4001";
  process.env.INTERNAL_SERVICE_SECRET ??= "internal-test-secret";
  jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(input.toString());

    if (url.pathname === "/users") {
      const ids = (url.searchParams.get("ids") ?? "")
        .split(",")
        .map(Number);

      return {
        ok: true,
        status: 200,
        json: async () =>
          ids
            .filter((id) => userNames.has(id))
            .map((id) => ({ id, name: userNames.get(id) })),
      } as Response;
    }

    if (url.pathname === "/internal/users/by-email") {
      if (
        (init?.headers as Record<string, string>)?.["X-Internal-Service-Secret"] !==
        process.env.INTERNAL_SERVICE_SECRET
      ) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: "Unauthorized" }),
        } as Response;
      }

      const email = url.searchParams.get("email") ?? "";
      identityLookupEmails.push(email);

      if (failIdentityLookup) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Failed" }),
        } as Response;
      }

      if (email === raceRecoveredEmail) {
        const lookupCount = identityLookupEmails.filter(
          (lookupEmail) => lookupEmail === raceRecoveredEmail
        ).length;

        if (lookupCount > 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: raceRecoveredUserId,
              name: "Race Recovered",
              email: raceRecoveredEmail,
              role: "user",
            }),
          } as Response;
        }
      }

      const user = identityUsersByEmail.get(email);

      return user
        ? ({
            ok: true,
            status: 200,
            json: async () => user,
          } as Response)
        : ({
            ok: false,
            status: 404,
            json: async () => ({ error: "User not found" }),
          } as Response);
    }

    if (url.pathname === "/internal/users/invited") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { email?: string };
      const email = body.email ?? "";
      identityCreateEmails.push(email);

      if (failIdentityCreate) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Failed" }),
        } as Response;
      }

      if (email === raceRecoveredEmail) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "User already exists" }),
        } as Response;
      }

      const user = {
        id: invitedCreatedUserId,
        name: "Created Invitee",
        email,
        role: "user",
      };
      identityUsersByEmail.set(email, user);

      return {
        ok: true,
        status: 201,
        json: async () => ({ user }),
      } as Response;
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    } as Response;
  });
  await initDb();
  await cleanupTestData();
});

beforeEach(() => {
  sendInvitationEmailMock.mockReset();
  sendInvitationEmailMock.mockResolvedValue();
  identityLookupEmails = [];
  identityCreateEmails = [];
  failIdentityLookup = false;
  failIdentityCreate = false;
  identityUsersByEmail.delete("new-invitee@example.com");
  identityUsersByEmail.delete("create-failure@example.com");
});

afterAll(async () => {
  await cleanupTestData();
  await pool.end();
  jest.restoreAllMocks();
});

describe("trip-service endpoints", () => {
  const token = jwt.sign(
    { id: userId, name: "Owner Traveler", email: ownerEmail },
    process.env.TRIP_JWT_SECRET ?? "test_identity_secret"
  );
  const nonOwnerToken = jwt.sign(
    { id: nonOwnerUserId, name: "Invited Traveler", email: invitedEmail },
    process.env.TRIP_JWT_SECRET ?? "test_identity_secret"
  );
  const participantToken = jwt.sign(
    { id: participantUserId, name: "Shared Traveler", email: participantEmail },
    process.env.TRIP_JWT_SECRET ?? "test_identity_secret"
  );
  const tokenWithoutEmail = jwt.sign(
    { id: nonOwnerUserId, name: "Invited Traveler" },
    process.env.TRIP_JWT_SECRET ?? "test_identity_secret"
  );
  let tripId = 0;
  let inviteToken = "";
  let duplicateParticipantInviteToken = "";

  it("rejects /trips without token", async () => {
    const response = await request(app).get("/trips");

    expect(response.status).toBe(401);
  });

  it("creates a trip with a valid token", async () => {
    const response = await request(app)
      .post("/trips")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Test Trip",
        description: "A test trip",
        destination: "Paris",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Test Trip");
    expect(response.body.destination).toBe("Paris");
    tripId = response.body.id;
  });

  it("adds the trip creator as owner participant", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/participants`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tripId,
          userId,
          name: "Owner Traveler",
          role: "owner",
        }),
      ])
    );
  });

  it("allows the owner to list participants", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/participants`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
  });

  it("allows the owner to add a participant", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/participants`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        userId: participantUserId,
        role: "viewer",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        tripId,
        userId: participantUserId,
        name: "Shared Traveler",
        role: "viewer",
      })
    );
  });

  it("allows a participant to list participants", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/participants`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: participantUserId,
          name: "Shared Traveler",
          role: "viewer",
        }),
      ])
    );
  });

  it("allows a participant to see a shared trip in GET /trips", async () => {
    const response = await request(app)
      .get("/trips")
      .set("Authorization", `Bearer ${participantToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: tripId,
          name: "Test Trip",
          start_date: expect.any(String),
          end_date: expect.any(String),
          created_by: userId,
          participants: expect.arrayContaining([
            expect.objectContaining({ userId, name: "Owner Traveler", role: "owner" }),
            expect.objectContaining({
              userId: participantUserId,
              name: "Shared Traveler",
              role: "viewer",
            }),
          ]),
        }),
      ])
    );
  });

  it("includes participants in GET /trips responses", async () => {
    const response = await request(app)
      .get("/trips")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: tripId,
          participants: expect.arrayContaining([
            expect.objectContaining({ userId, name: "Owner Traveler", role: "owner" }),
            expect.objectContaining({
              userId: participantUserId,
              name: "Shared Traveler",
              role: "viewer",
            }),
          ]),
        }),
      ])
    );
  });

  it("does not duplicate owner trips in GET /trips", async () => {
    const response = await request(app)
      .get("/trips")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.filter((trip: { id: number }) => trip.id === tripId)).toHaveLength(1);
  });

  it("allows a participant to open shared trip details", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: tripId,
        name: "Test Trip",
        participants: expect.arrayContaining([
          expect.objectContaining({
            userId: participantUserId,
            name: "Shared Traveler",
            role: "viewer",
          }),
        ]),
      })
    );
  });

  it("prevents duplicate participants", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/participants`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        userId: participantUserId,
        role: "viewer",
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Participant already exists");
  });

  it("does not allow a non-owner to add participants", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/participants`)
      .set("Authorization", `Bearer ${nonOwnerToken}`)
      .send({
        userId: 987657,
        role: "viewer",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Trip not found");
  });

  it("does not allow a participant to update or delete a trip", async () => {
    const updateResponse = await request(app)
      .put(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({ name: "Participant Update" });
    const deleteResponse = await request(app)
      .delete(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(updateResponse.status).toBe(403);
    expect(updateResponse.body.error).toBe("Forbidden");
    expect(deleteResponse.status).toBe(403);
    expect(deleteResponse.body.error).toBe("Forbidden");
  });

  it("does not allow a non-participant to update or delete a trip", async () => {
    const updateResponse = await request(app)
      .put(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${nonOwnerToken}`)
      .send({ name: "Outsider Update" });
    const deleteResponse = await request(app)
      .delete(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${nonOwnerToken}`);

    expect(updateResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
  });

  it("rejects an invalid trip update payload", async () => {
    const response = await request(app)
      .put(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("name is required");
  });

  it("rejects unauthenticated trip updates and deletes", async () => {
    const updateResponse = await request(app)
      .put(`/trips/${tripId}`)
      .send({ name: "Unauthorized Update" });
    const deleteResponse = await request(app).delete(`/trips/${tripId}`);

    expect(updateResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
  });

  it("does not allow unauthenticated users to access participant endpoints", async () => {
    const getResponse = await request(app).get(`/trips/${tripId}/participants`);
    const postResponse = await request(app)
      .post(`/trips/${tripId}/participants`)
      .send({ userId: 987658, role: "viewer" });

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
  });

  it("allows the owner to create an invite", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "invited@example.com",
        role: "viewer",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        tripId,
        email: "invited@example.com",
        role: "viewer",
        acceptedAt: null,
      })
    );
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.length).toBeGreaterThan(20);
    expect(sendInvitationEmailMock).toHaveBeenCalledWith({
      recipientEmail: "invited@example.com",
      inviterName: "Owner Traveler",
      tripName: "Test Trip",
      inviteToken: response.body.token,
    });
    inviteToken = response.body.token;
  });

  it("returns 502 and rolls back the invite when email sending fails", async () => {
    const beforeCount = await pool.query(
      "SELECT COUNT(*) FROM trip_invites WHERE trip_id = $1",
      [tripId]
    );
    sendInvitationEmailMock.mockRejectedValueOnce(new Error("Resend unavailable"));

    const response = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "rollback@example.com",
        role: "viewer",
      });

    const afterCount = await pool.query(
      "SELECT COUNT(*) FROM trip_invites WHERE trip_id = $1",
      [tripId]
    );
    const failedInviteCount = await pool.query(
      "SELECT COUNT(*) FROM trip_invites WHERE trip_id = $1 AND email = $2",
      [tripId, "rollback@example.com"]
    );

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("Failed to send invitation email");
    expect(Number(afterCount.rows[0].count)).toBe(
      Number(beforeCount.rows[0].count)
    );
    expect(Number(failedInviteCount.rows[0].count)).toBe(0);
  });

  it("does not send email for invalid invite requests", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "",
        role: "viewer",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("email is required");
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it("does not allow a non-owner to create an invite", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${nonOwnerToken}`)
      .send({
        email: "blocked@example.com",
        role: "viewer",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Trip not found");
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it("allows the owner to list invites", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tripId,
          email: "invited@example.com",
          token: inviteToken,
          role: "viewer",
        }),
      ])
    );
  });

  it("allows unauthenticated invite acceptance route access but requires login for an existing invited account", async () => {
    const response = await request(app).post(`/trips/invites/${inviteToken}/accept`);
    const inviteState = await pool.query<{ accepted_at: string | null }>(
      "SELECT accepted_at FROM trip_invites WHERE token = $1",
      [inviteToken]
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Login required for invited email" });
    expect(identityLookupEmails).toEqual([invitedEmail]);
    expect(identityCreateEmails).toEqual([]);
    expect(inviteState.rows[0].accepted_at).toBeNull();
  });

  it("returns 401 for malformed or invalid supplied Bearer tokens on invite acceptance", async () => {
    const response = await request(app)
      .post(`/trips/invites/${inviteToken}/accept`)
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Unauthorized");
  });

  it("returns 403 when authenticated JWT has no email for invite acceptance", async () => {
    const response = await request(app)
      .post(`/trips/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${tokenWithoutEmail}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Authenticated account email is unavailable");
  });

  it("returns 403 when authenticated email does not match invite email", async () => {
    const response = await request(app)
      .post(`/trips/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${participantToken}`);
    const inviteState = await pool.query<{ accepted_at: string | null }>(
      "SELECT accepted_at FROM trip_invites WHERE token = $1",
      [inviteToken]
    );

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Invite belongs to a different email");
    expect(inviteState.rows[0].accepted_at).toBeNull();
    expect(identityLookupEmails).toEqual([]);
    expect(identityCreateEmails).toEqual([]);
  });

  it("accepting an invite adds a participant", async () => {
    const acceptResponse = await request(app)
      .post(`/trips/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${nonOwnerToken}`);

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.acceptedAt).toEqual(expect.any(String));
    expect(acceptResponse.body.accountCreated).toBe(false);
    expect(identityLookupEmails).toEqual([]);
    expect(identityCreateEmails).toEqual([]);

    const participantsResponse = await request(app)
      .get(`/trips/${tripId}/participants`)
      .set("Authorization", `Bearer ${token}`);

    expect(participantsResponse.status).toBe(200);
    expect(participantsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tripId,
          userId: nonOwnerUserId,
          role: "viewer",
        }),
      ])
    );
  });

  it("matches authenticated invite email case-insensitively after trimming", async () => {
    const inviteResponse = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "casey@example.com",
        role: "viewer",
      });
    const caseToken = jwt.sign(
      { id: 987660, name: "Case Traveler", email: "  CASEY@EXAMPLE.COM  " },
      process.env.TRIP_JWT_SECRET ?? "test_identity_secret"
    );

    const response = await request(app)
      .post(`/trips/invites/${inviteResponse.body.token}/accept`)
      .set("Authorization", `Bearer ${caseToken}`);

    expect(response.status).toBe(200);
    expect(response.body.accountCreated).toBe(false);
  });

  it("creates an invited Identity user for unauthenticated new accounts", async () => {
    const inviteResponse = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "New-Invitee@Example.com",
        role: "viewer",
      });

    const response = await request(app).post(
      `/trips/invites/${inviteResponse.body.token}/accept`
    );
    const participantResult = await pool.query(
      "SELECT id FROM trip_participants WHERE trip_id = $1 AND user_id = $2",
      [tripId, invitedCreatedUserId]
    );

    expect(response.status).toBe(200);
    expect(response.body.accountCreated).toBe(true);
    expect(response.body).not.toHaveProperty("user");
    expect(JSON.stringify(response.body)).not.toContain("Created Invitee");
    expect(identityLookupEmails).toEqual(["new-invitee@example.com"]);
    expect(identityCreateEmails).toEqual(["new-invitee@example.com"]);
    expect(participantResult.rowCount).toBe(1);
  });

  it("returns login required and rolls back when invited-user creation recovers an existing account race", async () => {
    const inviteResponse = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: raceRecoveredEmail,
        role: "viewer",
      });

    const response = await request(app).post(
      `/trips/invites/${inviteResponse.body.token}/accept`
    );
    const participantResult = await pool.query(
      "SELECT id FROM trip_participants WHERE trip_id = $1 AND user_id = $2",
      [tripId, raceRecoveredUserId]
    );
    const inviteState = await pool.query<{ accepted_at: string | null }>(
      "SELECT accepted_at FROM trip_invites WHERE token = $1",
      [inviteResponse.body.token]
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Login required for invited email" });
    expect(response.body).not.toHaveProperty("accountCreated");
    expect(identityLookupEmails).toEqual([raceRecoveredEmail, raceRecoveredEmail]);
    expect(identityCreateEmails).toEqual([raceRecoveredEmail]);
    expect(participantResult.rowCount).toBe(0);
    expect(inviteState.rows[0].accepted_at).toBeNull();
  });

  it("returns 502 when Identity lookup fails and leaves invite unaccepted", async () => {
    const inviteResponse = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "identity-lookup-fail@example.com",
        role: "viewer",
      });
    failIdentityLookup = true;

    const response = await request(app).post(
      `/trips/invites/${inviteResponse.body.token}/accept`
    );
    const inviteState = await pool.query<{ accepted_at: string | null }>(
      "SELECT accepted_at FROM trip_invites WHERE token = $1",
      [inviteResponse.body.token]
    );

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("Failed to process invited account");
    expect(inviteState.rows[0].accepted_at).toBeNull();
  });

  it("returns 502 when Identity invited-user creation fails and leaves invite unaccepted", async () => {
    const inviteResponse = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "create-failure@example.com",
        role: "viewer",
      });
    failIdentityCreate = true;

    const response = await request(app).post(
      `/trips/invites/${inviteResponse.body.token}/accept`
    );
    const inviteState = await pool.query<{ accepted_at: string | null }>(
      "SELECT accepted_at FROM trip_invites WHERE token = $1",
      [inviteResponse.body.token]
    );

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("Failed to process invited account");
    expect(inviteState.rows[0].accepted_at).toBeNull();
  });

  it("returns 500 when invite acceptance cannot connect to the database", async () => {
    const connectSpy = jest.spyOn(pool, "connect") as jest.SpyInstance;
    connectSpy.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await request(app).post(
      "/trips/invites/connect-failure-token/accept"
    );

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Failed to accept trip invite");
    connectSpy.mockRestore();
  });

  it("returns 400 when invite token is blank", async () => {
    const response = await request(app).post("/trips/invites/%20/accept");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invite token is required");
  });

  it("accepting an invalid invite token returns 404", async () => {
    const response = await request(app)
      .post("/trips/invites/not-a-real-token/accept")
      .set("Authorization", `Bearer ${nonOwnerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Invite not found");
  });

  it("accepting an already accepted invite returns 409", async () => {
    const response = await request(app)
      .post(`/trips/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${nonOwnerToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Invite already accepted");
  });

  it("handles duplicate participant acceptance gracefully", async () => {
    const inviteResponse = await request(app)
      .post(`/trips/${tripId}/invites`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "participant@example.com",
        role: "viewer",
      });

    expect(inviteResponse.status).toBe(201);
    duplicateParticipantInviteToken = inviteResponse.body.token;

    const acceptResponse = await request(app)
      .post(`/trips/invites/${duplicateParticipantInviteToken}/accept`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.acceptedAt).toEqual(expect.any(String));
  });

  it("gets trips with a valid token", async () => {
    const response = await request(app)
      .get("/trips")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tripId, name: "Test Trip" })])
    );
  });

  it("does not allow a participant to create itinerary items", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/itinerary`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        title: "Participant plan",
        scheduledDate: "2026-06-02",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Trip not found");
  });

  it("creates an itinerary item", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Museum",
        description: "Visit the city museum",
        scheduledDate: "2026-06-02",
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe("Museum");
  });

  it("gets itinerary items", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/itinerary`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Museum" })])
    );
  });

  it("allows a participant to view itinerary items", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/itinerary`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Museum" })])
    );
  });

  it("does not allow a participant to update or delete itinerary items", async () => {
    const updateResponse = await request(app)
      .put(`/trips/${tripId}/itinerary/1`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({ title: "Updated Museum" });
    const deleteResponse = await request(app)
      .delete(`/trips/${tripId}/itinerary/1`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });

  it("does not allow a participant to create expenses", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/expenses`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({
        title: "Participant hotel",
        amount: 100,
        currency: "EUR",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Trip not found");
  });

  it("creates an expense", async () => {
    const response = await request(app)
      .post(`/trips/${tripId}/expenses`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Hotel",
        amount: 250,
        currency: "EUR",
        category: "Accommodation",
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe("Hotel");
    expect(response.body.amount).toBe(250);
  });

  it("gets expenses", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/expenses`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Hotel", amount: 250 })])
    );
  });

  it("allows a participant to view expenses", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/expenses`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Hotel", amount: 250 })])
    );
  });

  it("does not allow a participant to update or delete expenses", async () => {
    const updateResponse = await request(app)
      .put(`/trips/${tripId}/expenses/1`)
      .set("Authorization", `Bearer ${participantToken}`)
      .send({ title: "Updated Hotel" });
    const deleteResponse = await request(app)
      .delete(`/trips/${tripId}/expenses/1`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });

  it("gets trip summary", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/summary`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        itineraryCount: 1,
        expenseCount: 1,
        totalExpenses: 250,
        tripDurationDays: 4,
      })
    );
  });

  it("allows a participant to view trip summary", async () => {
    const response = await request(app)
      .get(`/trips/${tripId}/summary`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        itineraryCount: 1,
        expenseCount: 1,
        totalExpenses: 250,
        tripDurationDays: 4,
      })
    );
  });

  it("allows the owner to update a trip", async () => {
    const response = await request(app)
      .put(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Test Trip",
        description: "Updated description",
        destination: "Rome",
        startDate: "2026-07-01",
        endDate: "2026-07-08",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: tripId,
        name: "Updated Test Trip",
        description: "Updated description",
        destination: "Rome",
      })
    );
  });

  it("allows the owner to delete a trip and removes related data", async () => {
    const response = await request(app)
      .delete(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const listResponse = await request(app)
      .get("/trips")
      .set("Authorization", `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tripId })])
    );

    const relatedCounts = await Promise.all([
      pool.query("SELECT COUNT(*) FROM trip_participants WHERE trip_id = $1", [tripId]),
      pool.query("SELECT COUNT(*) FROM trip_invites WHERE trip_id = $1", [tripId]),
      pool.query("SELECT COUNT(*) FROM itinerary_items WHERE trip_id = $1", [tripId]),
      pool.query("SELECT COUNT(*) FROM expenses WHERE trip_id = $1", [tripId]),
    ]);
    expect(relatedCounts.every((result) => Number(result.rows[0].count) === 0)).toBe(true);

    const updateDeletedResponse = await request(app)
      .put(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Deleted trip" });
    const deleteDeletedResponse = await request(app)
      .delete(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(updateDeletedResponse.status).toBe(404);
    expect(deleteDeletedResponse.status).toBe(404);
  });
});
