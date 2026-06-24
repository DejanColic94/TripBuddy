import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";

const email = `test-${Date.now()}@example.com`;
const password = "password123";

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
      .send({ email, password });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
  });

  it("prevents duplicate register", async () => {
    const response = await request(app)
      .post("/register")
      .send({ email, password });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Email already exists");
  });

  it("logs in a user", async () => {
    const response = await request(app)
      .post("/login")
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
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
    expect(response.body.email).toBe(email);
  });

  it("rejects /me without token", async () => {
    const response = await request(app).get("/me");

    expect(response.status).toBe(401);
  });
});
