import { createHash } from "crypto";
import request from "supertest";
import app from "../app";
import pool, { initDb } from "../db";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
} from "../services/emailService";

jest.mock("../services/emailService", () => ({
  ...jest.requireActual("../services/emailService"),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

const mockedSendEmailVerification =
  sendEmailVerification as jest.MockedFunction<typeof sendEmailVerification>;
const mockedSendPasswordResetEmail =
  sendPasswordResetEmail as jest.MockedFunction<typeof sendPasswordResetEmail>;
const email = `recovery-${Date.now()}@example.com`;
const password = "password123";

beforeAll(async () => {
  mockedSendEmailVerification.mockResolvedValue();
  await initDb();
  await pool.query(
    "DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    [email]
  );
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await request(app)
    .post("/register")
    .send({ name: "Recovery Traveler", email, password });
  await pool.query("UPDATE users SET email_verified = TRUE WHERE email = $1", [
    email,
  ]);
});

afterAll(async () => {
  await pool.query(
    "DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    [email]
  );
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await pool.end();
});

beforeEach(() => {
  mockedSendPasswordResetEmail.mockReset();
  mockedSendPasswordResetEmail.mockResolvedValue();
});

describe("password recovery", () => {
  it("creates a hashed reset token and sends the raw token by email", async () => {
    const response = await request(app)
      .post("/forgot-password")
      .send({ email: email.toUpperCase() });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "If an account exists for that email, a reset link has been sent"
    );
    expect(mockedSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const resetToken =
      mockedSendPasswordResetEmail.mock.calls[0][0].resetToken;
    const tokenHash = createHash("sha256").update(resetToken).digest("hex");
    const storedToken = await pool.query(
      `
        SELECT
          token_hash,
          expires_at,
          used_at,
          expires_at > CURRENT_TIMESTAMP AS is_valid
        FROM password_reset_tokens
        WHERE token_hash = $1
      `,
      [tokenHash]
    );

    expect(storedToken.rowCount).toBe(1);
    expect(storedToken.rows[0].token_hash).toBe(tokenHash);
    expect(storedToken.rows[0].token_hash).not.toBe(resetToken);
    expect(storedToken.rows[0].used_at).toBeNull();
    expect(storedToken.rows[0].is_valid).toBe(true);
  });

  it("returns the same response for an unknown email without sending mail", async () => {
    const response = await request(app)
      .post("/forgot-password")
      .send({ email: `unknown-${Date.now()}@example.com` });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "If an account exists for that email, a reset link has been sent"
    );
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("resets the password once and rejects token reuse", async () => {
    await pool.query(
      "DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [email]
    );
    await request(app).post("/forgot-password").send({ email });
    const resetToken =
      mockedSendPasswordResetEmail.mock.calls[0][0].resetToken;
    const newPassword = "recovered-password-456";

    const resetResponse = await request(app)
      .post("/reset-password")
      .send({ token: resetToken, newPassword });
    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.message).toBe("Password reset successfully");

    const loginResponse = await request(app)
      .post("/login")
      .send({ email, password: newPassword });
    expect(loginResponse.status).toBe(200);

    const reuseResponse = await request(app)
      .post("/reset-password")
      .send({ token: resetToken, newPassword: "another-password-789" });
    expect(reuseResponse.status).toBe(400);
    expect(reuseResponse.body.message).toBe(
      "Reset link is invalid or has expired"
    );

    const restoreToken = "restore-test-password-token";
    await pool.query(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        SELECT id, $1, CURRENT_TIMESTAMP + INTERVAL '30 minutes'
        FROM users
        WHERE email = $2
      `,
      [createHash("sha256").update(restoreToken).digest("hex"), email]
    );
    await request(app)
      .post("/reset-password")
      .send({ token: restoreToken, newPassword: password });
  });

  it("rejects an expired token", async () => {
    const expiredToken = "expired-reset-token";
    await pool.query(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        SELECT id, $1, CURRENT_TIMESTAMP - INTERVAL '1 minute'
        FROM users
        WHERE email = $2
      `,
      [createHash("sha256").update(expiredToken).digest("hex"), email]
    );

    const response = await request(app)
      .post("/reset-password")
      .send({ token: expiredToken, newPassword: "new-password-456" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Reset link is invalid or has expired"
    );
  });

  it("rolls back the token when reset email delivery fails", async () => {
    await pool.query(
      "DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [email]
    );
    mockedSendPasswordResetEmail.mockRejectedValueOnce(
      new Error("Email provider unavailable")
    );

    const response = await request(app)
      .post("/forgot-password")
      .send({ email });

    expect(response.status).toBe(200);
    const storedTokens = await pool.query(
      "SELECT id FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [email]
    );
    expect(storedTokens.rowCount).toBe(0);
  });
});
