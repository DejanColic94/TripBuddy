import bcrypt from "bcrypt";
import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";

const internalSecret = "internal-test-secret";
const testEmail = `Internal.Lookup.${Date.now()}@Example.com`;
const testName = "Internal Lookup Traveler";

async function cleanupTestData() {
  await pool.query("DELETE FROM users WHERE LOWER(email) = LOWER($1)", [
    testEmail,
  ]);
}

describe("identity-service internal routes", () => {
  const originalEnv = process.env;

  beforeAll(async () => {
    await initDb();
    await cleanupTestData();
    const hashedPassword = await bcrypt.hash("password123", 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
      [testName, testEmail, hashedPassword, "user"]
    );
  });

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      INTERNAL_SERVICE_SECRET: internalSecret,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.end();
  });

  it("returns a safe user object for an existing email with a valid internal secret", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .query({ email: testEmail })
      .set("X-Internal-Service-Secret", internalSecret);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(Number),
      name: testName,
      email: testEmail,
      role: "user",
    });
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("created_at");
    expect(response.body).not.toHaveProperty("token");
  });

  it("looks up users case-insensitively", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .query({ email: testEmail.toUpperCase() })
      .set("X-Internal-Service-Secret", internalSecret);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(testEmail);
  });

  it("ignores surrounding whitespace in the email query", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .query({ email: `  ${testEmail}  ` })
      .set("X-Internal-Service-Secret", internalSecret);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(testEmail);
  });

  it("returns 400 when email is missing", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .set("X-Internal-Service-Secret", internalSecret);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email is required" });
  });

  it("returns 400 when email is blank", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .query({ email: "   " })
      .set("X-Internal-Service-Secret", internalSecret);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email is required" });
  });

  it("returns 404 when the email is unknown", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .query({ email: `unknown-${Date.now()}@example.com` })
      .set("X-Internal-Service-Secret", internalSecret);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "User not found" });
  });

  it("returns 401 when the internal secret header is missing", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .query({ email: testEmail });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when the internal secret header is wrong", async () => {
    const response = await request(app)
      .get("/internal/users/by-email")
      .query({ email: testEmail })
      .set("X-Internal-Service-Secret", "wrong-secret");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("leaves public auth routes unaffected", async () => {
    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Auth routing works" });
  });
});
