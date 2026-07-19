import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";

const email = `test-${Date.now()}@example.com`;
const password = "password123";
const name = "Test Traveler";

beforeAll(async () => {
  process.env.IDENTITY_JWT_SECRET ??= "test_identity_secret";
  await initDb();
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await pool.end();
});

describe("identity-service auth endpoints", () => {
  let token = "";

  it("registers a user", async () => {
    const response = await request(app)
      .post("/register")
      .send({ name, email, password });

    expect(response.status).toBe(201);
    expect(response.body.user.name).toBe(name);
    expect(response.body.user.email).toBe(email);
  });

  it("rejects register without a name", async () => {
    const response = await request(app)
      .post("/register")
      .send({ email: `missing-name-${Date.now()}@example.com`, password });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Name is required");
  });

  it("prevents duplicate register", async () => {
    const response = await request(app)
      .post("/register")
      .send({ name, email, password });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Email already exists");
  });

  it("logs in a user", async () => {
    const response = await request(app)
      .post("/login")
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toEqual(
      expect.objectContaining({ name, email })
    );
    token = response.body.token;
  });

  it("rejects invalid login", async () => {
    const response = await request(app)
      .post("/login")
      .send({ email, password: "wrong-password" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("gets /me with a valid token", async () => {
    const response = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe(name);
    expect(response.body.email).toBe(email);
  });

  it("gets the current profile for a legacy token without a name claim", async () => {
    const loginResponse = await request(app)
      .post("/login")
      .send({ email, password });
    const legacyToken = jwt.sign(
      {
        id: loginResponse.body.user.id,
        email,
        role: "user",
      },
      process.env.IDENTITY_JWT_SECRET ?? "test_identity_secret"
    );
    const response = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${legacyToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ name, email })
    );
  });

  it("gets users by id with a valid token", async () => {
    const meResponse = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${token}`);
    const response = await request(app)
      .get(`/users?ids=${meResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ name })])
    );
  });

  it("rejects /me without token", async () => {
    const response = await request(app).get("/me");

    expect(response.status).toBe(401);
  });
});
