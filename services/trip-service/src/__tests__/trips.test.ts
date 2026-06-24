import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";

const userId = 987654;
const participantUserId = 987655;
const nonOwnerUserId = 987656;

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
  await initDb();
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await pool.end();
});

describe("trip-service endpoints", () => {
  const token = jwt.sign({ id: userId }, process.env.TRIP_JWT_SECRET ?? "test_identity_secret");
  const nonOwnerToken = jwt.sign(
    { id: nonOwnerUserId },
    process.env.TRIP_JWT_SECRET ?? "test_identity_secret"
  );
  const participantToken = jwt.sign(
    { id: participantUserId },
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
        startDate: "2026-06-01",
        endDate: "2026-06-05",
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Test Trip");
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
            expect.objectContaining({ userId, role: "owner" }),
            expect.objectContaining({ userId: participantUserId, role: "viewer" }),
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
            expect.objectContaining({ userId, role: "owner" }),
            expect.objectContaining({ userId: participantUserId, role: "viewer" }),
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
          expect.objectContaining({ userId: participantUserId, role: "viewer" }),
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
      .send({ name: "Updated Trip" });
    const deleteResponse = await request(app)
      .delete(`/trips/${tripId}`)
      .set("Authorization", `Bearer ${participantToken}`);

    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
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
    inviteToken = response.body.token;
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

  it("accepting an invite adds a participant", async () => {
    const acceptResponse = await request(app)
      .post(`/trips/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${nonOwnerToken}`);

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.acceptedAt).toEqual(expect.any(String));

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
});
