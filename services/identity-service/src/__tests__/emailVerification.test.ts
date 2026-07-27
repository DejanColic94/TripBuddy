import { createHash } from "crypto";
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
const email = `verification-${Date.now()}@example.com`;
const failedEmail = `verification-failed-${Date.now()}@example.com`;
const password = "password123";

beforeAll(async () => {
  await initDb();
  mockedSendEmailVerification.mockResolvedValue();
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email = ANY($1::text[])", [
    [email, failedEmail],
  ]);
  await pool.end();
});

describe("email verification", () => {
  it("registers an unverified account and stores only the token hash", async () => {
    const response = await request(app)
      .post("/register")
      .send({ name: "Verification Traveler", email, password });

    expect(response.status).toBe(201);
    expect(response.body.user.emailVerified).toBe(false);
    const verificationToken =
      mockedSendEmailVerification.mock.calls[0][0].verificationToken;
    const tokenHash = createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    const storedToken = await pool.query(
      `
        SELECT token_hash, expires_at > CURRENT_TIMESTAMP AS is_valid
        FROM email_verification_tokens
        WHERE token_hash = $1
      `,
      [tokenHash]
    );

    expect(storedToken.rowCount).toBe(1);
    expect(storedToken.rows[0].token_hash).not.toBe(verificationToken);
    expect(storedToken.rows[0].is_valid).toBe(true);
  });

  it("blocks login until the email is verified", async () => {
    const response = await request(app)
      .post("/login")
      .send({ email, password });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Email verification required");
  });

  it("verifies the email once and then permits login", async () => {
    const verificationToken =
      mockedSendEmailVerification.mock.calls[0][0].verificationToken;
    const response = await request(app)
      .post("/verify-email")
      .send({ token: verificationToken });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Email verified successfully");

    const reuseResponse = await request(app)
      .post("/verify-email")
      .send({ token: verificationToken });
    expect(reuseResponse.status).toBe(400);

    const loginResponse = await request(app)
      .post("/login")
      .send({ email, password });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.emailVerified).toBe(true);
  });

  it("returns the same resend response for verified and unknown emails", async () => {
    const verifiedResponse = await request(app)
      .post("/resend-verification")
      .send({ email });
    const unknownResponse = await request(app)
      .post("/resend-verification")
      .send({ email: `unknown-${Date.now()}@example.com` });

    expect(verifiedResponse.status).toBe(200);
    expect(unknownResponse.status).toBe(200);
    expect(verifiedResponse.body).toEqual(unknownResponse.body);
  });

  it("rejects an expired verification token", async () => {
    const expiredToken = "expired-verification-token";
    await pool.query(
      `
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        SELECT id, $1, CURRENT_TIMESTAMP - INTERVAL '1 minute'
        FROM users
        WHERE email = $2
      `,
      [createHash("sha256").update(expiredToken).digest("hex"), email]
    );

    const response = await request(app)
      .post("/verify-email")
      .send({ token: expiredToken });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Verification link is invalid or has expired"
    );
  });

  it("rolls back registration when verification email delivery fails", async () => {
    mockedSendEmailVerification.mockRejectedValueOnce(
      new Error("Email provider unavailable")
    );

    const response = await request(app)
      .post("/register")
      .send({
        name: "Failed Verification",
        email: failedEmail,
        password,
      });

    expect(response.status).toBe(500);
    const storedUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [failedEmail]
    );
    expect(storedUser.rowCount).toBe(0);
  });
});
