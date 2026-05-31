import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";

const userId = 987654;

beforeAll(async () => {
  process.env.TRIP_JWT_SECRET ??= "test_identity_secret";
  await initDb();
  await pool.query("DELETE FROM expenses WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)", [
    userId,
  ]);
  await pool.query(
    "DELETE FROM itinerary_items WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)",
    [userId]
  );
  await pool.query("DELETE FROM trips WHERE created_by = $1", [userId]);
});

afterAll(async () => {
  await pool.query("DELETE FROM expenses WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)", [
    userId,
  ]);
  await pool.query(
    "DELETE FROM itinerary_items WHERE trip_id IN (SELECT id FROM trips WHERE created_by = $1)",
    [userId]
  );
  await pool.query("DELETE FROM trips WHERE created_by = $1", [userId]);
  await pool.end();
});

describe("trip-service endpoints", () => {
  const token = jwt.sign({ id: userId }, process.env.TRIP_JWT_SECRET ?? "test_identity_secret");
  let tripId = 0;

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

  it("gets trips with a valid token", async () => {
    const response = await request(app)
      .get("/trips")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tripId, name: "Test Trip" })])
    );
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
});
