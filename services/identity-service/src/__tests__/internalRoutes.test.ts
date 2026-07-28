import bcrypt from "bcrypt";
import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";

const internalSecret = "internal-test-secret";
const testRunPrefix = `internal-route-${Date.now()}`;
const testDomain = `${testRunPrefix}.example.com`;
const testEmail = `Lookup@${testRunPrefix}.Example.com`;
const testName = "Internal Lookup Traveler";

async function cleanupTestData() {
  await pool.query("DELETE FROM users WHERE LOWER(email) LIKE $1", [
    `%@${testDomain.toLowerCase()}`,
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

  it("creates an invited user and returns a safe user object", async () => {
    const response = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({
        email: `new@${testDomain}`,
        name: "New Traveler",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: expect.any(Number),
        name: "New Traveler",
        email: `new@${testDomain}`,
        role: "user",
      },
    });
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("temporaryPassword");
    expect(response.body.user).not.toHaveProperty("token");
    expect(response.body.user).not.toHaveProperty("created_at");
  });

  it("normalizes the email and trims the chosen name", async () => {
    const response = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({
        email: `  Mixed@${testDomain.toUpperCase()}  `,
        name: "  Mixed Traveler  ",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(`mixed@${testDomain}`);
    expect(response.body.user.name).toBe("Mixed Traveler");
  });

  it("stores the chosen password as a bcrypt hash", async () => {
    const chosenPassword = "chosen-password-123";
    const response = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({
        email: `password@${testDomain}`,
        name: "Password Traveler",
        password: chosenPassword,
      });

    expect(response.status).toBe(201);
    const storedUser = await pool.query<{ password: string }>(
      "SELECT password FROM users WHERE email = $1",
      [`password@${testDomain}`]
    );
    expect(storedUser.rows[0].password).not.toBe(chosenPassword);
    expect(JSON.stringify(response.body)).not.toContain(chosenPassword);
    await expect(
      bcrypt.compare(chosenPassword, storedUser.rows[0].password)
    ).resolves.toBe(true);
  });

  it("returns 409 when the user already exists", async () => {
    const response = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({
        email: testEmail.toLowerCase(),
        name: "Duplicate Traveler",
        password: "password123",
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "User already exists" });
  });

  it("returns 400 for missing invited-user email", async () => {
    const response = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email is required" });
  });

  it("returns 400 for blank invited-user email", async () => {
    const response = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({ email: "   " });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "email is required" });
  });

  it("keeps invited-user creation protected by the internal secret", async () => {
    const missingSecretResponse = await request(app)
      .post("/internal/users/invited")
      .send({
        email: `blocked@${testDomain}`,
        name: "Blocked Traveler",
        password: "password123",
      });
    const wrongSecretResponse = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", "wrong-secret")
      .send({
        email: `blocked@${testDomain}`,
        name: "Blocked Traveler",
        password: "password123",
      });

    expect(missingSecretResponse.status).toBe(401);
    expect(missingSecretResponse.body).toEqual({ error: "Unauthorized" });
    expect(wrongSecretResponse.status).toBe(401);
    expect(wrongSecretResponse.body).toEqual({ error: "Unauthorized" });
  });

  it("rejects missing and weak account details", async () => {
    const missingNameResponse = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({ email: `details@${testDomain}`, password: "password123" });
    const weakPasswordResponse = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({
        email: `details@${testDomain}`,
        name: "Details Traveler",
        password: "short",
      });

    expect(missingNameResponse.status).toBe(400);
    expect(missingNameResponse.body.error).toBe("name is required");
    expect(weakPasswordResponse.status).toBe(400);
    expect(weakPasswordResponse.body.error).toBe(
      "password must be at least 8 characters"
    );
  });

  it("returns 500 when invited-user creation cannot connect to the database", async () => {
    const connectSpy = jest.spyOn(pool, "connect") as jest.SpyInstance;
    connectSpy.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await request(app)
      .post("/internal/users/invited")
      .set("X-Internal-Service-Secret", internalSecret)
      .send({
        email: `db-failure@${testDomain}`,
        name: "Database Failure",
        password: "password123",
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Failed to create invited user" });
    connectSpy.mockRestore();
  });
});
