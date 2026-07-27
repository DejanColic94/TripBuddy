import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";
import { sendEmailVerification } from "../services/emailService";

jest.mock("../services/emailService", () => ({
  ...jest.requireActual("../services/emailService"),
  sendEmailVerification: jest.fn(),
}));

const mockedSendEmailVerification =
  sendEmailVerification as jest.MockedFunction<typeof sendEmailVerification>;

const email = `test-${Date.now()}@example.com`;
const password = "password123";
const name = "Test Traveler";
const changedEmail = `changed-${Date.now()}@example.com`;
const existingEmail = `existing-${Date.now()}@example.com`;

beforeAll(async () => {
  process.env.IDENTITY_JWT_SECRET ??= "test_identity_secret";
  mockedSendEmailVerification.mockResolvedValue();
  await initDb();
});

afterAll(async () => {
  await pool.query(
    "DELETE FROM users WHERE LOWER(email) = ANY($1::text[])",
    [[email, changedEmail, existingEmail].map((value) => value.toLowerCase())]
  );
  await pool.end();
});

describe("identity-service auth endpoints", () => {
  let token = "";

  it("registers a user", async () => {
    const response = await request(app)
      .post("/register")
      .send({
        name: `  ${name}  `,
        email: `  ${email.toUpperCase()}  `,
        password,
      });

    expect(response.status).toBe(201);
    expect(response.body.user.name).toBe(name);
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.emailVerified).toBe(false);
    expect(mockedSendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: email })
    );

    await pool.query("UPDATE users SET email_verified = TRUE WHERE email = $1", [
      email,
    ]);
  });

  it("rejects register without a name", async () => {
    const response = await request(app)
      .post("/register")
      .send({ email: `missing-name-${Date.now()}@example.com`, password });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Name is required");
  });

  it("rejects a registration name longer than 255 characters", async () => {
    const response = await request(app)
      .post("/register")
      .send({
        name: "a".repeat(256),
        email: `long-name-${Date.now()}@example.com`,
        password,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Name must be 255 characters or fewer"
    );
  });

  it("rejects an invalid registration email", async () => {
    const response = await request(app)
      .post("/register")
      .send({ name, email: "not-an-email", password });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Enter a valid email address");
  });

  it("rejects a registration password shorter than 8 characters", async () => {
    const response = await request(app)
      .post("/register")
      .send({
        name,
        email: `short-password-${Date.now()}@example.com`,
        password: "short",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Password must be at least 8 characters"
    );
  });

  it("rejects a registration password above bcrypt's byte limit", async () => {
    const response = await request(app)
      .post("/register")
      .send({
        name,
        email: `long-password-${Date.now()}@example.com`,
        password: "ž".repeat(37),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Password must be 72 bytes or fewer"
    );
  });

  it("prevents duplicate register", async () => {
    const response = await request(app)
      .post("/register")
      .send({ name, email: email.toUpperCase(), password });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Email already exists");
  });

  it("logs in a user", async () => {
    const response = await request(app)
      .post("/login")
      .send({ email: `  ${email.toUpperCase()}  `, password });

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

  it("updates the current user's name", async () => {
    const response = await request(app)
      .patch("/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "  Updated Traveler  " });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(
      expect.objectContaining({
        name: "Updated Traveler",
        email,
        role: "user",
      })
    );
    expect(response.body.token).toEqual(expect.any(String));
    expect(
      jwt.verify(
        response.body.token,
        process.env.IDENTITY_JWT_SECRET ?? "test_identity_secret"
      )
    ).toEqual(expect.objectContaining({ name: "Updated Traveler" }));

    const storedUser = await pool.query(
      "SELECT name FROM users WHERE email = $1",
      [email]
    );
    expect(storedUser.rows[0].name).toBe("Updated Traveler");

    await pool.query("UPDATE users SET name = $1 WHERE email = $2", [
      name,
      email,
    ]);
  });

  it("rejects a blank profile name", async () => {
    const response = await request(app)
      .patch("/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Name is required");
  });

  it("rejects a profile name longer than 255 characters", async () => {
    const response = await request(app)
      .patch("/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "a".repeat(256) });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Name must be 255 characters or fewer"
    );
  });

  it("rejects profile updates without authentication", async () => {
    const response = await request(app)
      .patch("/me")
      .send({ name: "Unauthorized Traveler" });

    expect(response.status).toBe(401);
  });

  it("changes email after verifying the current password", async () => {
    const response = await request(app)
      .patch("/me/email")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `  ${changedEmail.toUpperCase()}  `,
        currentPassword: password,
      });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(changedEmail);
    expect(response.body.token).toEqual(expect.any(String));
    expect(
      jwt.verify(
        response.body.token,
        process.env.IDENTITY_JWT_SECRET ?? "test_identity_secret"
      )
    ).toEqual(expect.objectContaining({ email: changedEmail }));

    const storedUser = await pool.query(
      "SELECT email FROM users WHERE id = $1",
      [response.body.user.id]
    );
    expect(storedUser.rows[0].email).toBe(changedEmail);

    await pool.query("UPDATE users SET email = $1 WHERE id = $2", [
      email,
      response.body.user.id,
    ]);
  });

  it("rejects an email change when the current password is wrong", async () => {
    const response = await request(app)
      .patch("/me/email")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: changedEmail,
        currentPassword: "wrong-password",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Current password is incorrect");
  });

  it("rejects an invalid new email", async () => {
    const response = await request(app)
      .patch("/me/email")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "not-an-email", currentPassword: password });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Enter a valid email address");
  });

  it("rejects an unchanged email", async () => {
    const response = await request(app)
      .patch("/me/email")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: email.toUpperCase(), currentPassword: password });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "New email must be different from current email"
    );
  });

  it("rejects an email already used by another account", async () => {
    const registerResponse = await request(app)
      .post("/register")
      .send({ name: "Existing User", email: existingEmail, password });
    expect(registerResponse.status).toBe(201);

    const response = await request(app)
      .patch("/me/email")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: existingEmail.toUpperCase(),
        currentPassword: password,
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Email already exists");
  });

  it("rejects email changes without authentication", async () => {
    const response = await request(app)
      .patch("/me/email")
      .send({ email: changedEmail, currentPassword: password });

    expect(response.status).toBe(401);
  });

  it("changes password after verifying the current password", async () => {
    const newPassword = "new-password-456";
    const response = await request(app)
      .patch("/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: password, newPassword });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Password updated");

    const loginResponse = await request(app)
      .post("/login")
      .send({ email, password: newPassword });
    expect(loginResponse.status).toBe(200);

    const restoreResponse = await request(app)
      .patch("/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: newPassword, newPassword: password });
    expect(restoreResponse.status).toBe(200);
  });

  it("rejects a password change when the current password is wrong", async () => {
    const response = await request(app)
      .patch("/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: "wrong-password",
        newPassword: "new-password-456",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Current password is incorrect");
  });

  it("rejects a weak new password", async () => {
    const response = await request(app)
      .patch("/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: "short" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "New password must be at least 8 characters"
    );
  });

  it("rejects a new password longer than bcrypt's byte limit", async () => {
    const response = await request(app)
      .patch("/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: "ž".repeat(37) });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "New password must be 72 bytes or fewer"
    );
  });

  it("rejects reusing the current password", async () => {
    const response = await request(app)
      .patch("/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: password });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "New password must be different from current password"
    );
  });

  it("rejects password changes without authentication", async () => {
    const response = await request(app)
      .patch("/me/password")
      .send({
        currentPassword: password,
        newPassword: "new-password-456",
      });

    expect(response.status).toBe(401);
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
