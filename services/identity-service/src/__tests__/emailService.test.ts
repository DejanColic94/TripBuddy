import { Resend } from "resend";
import { sendTemporaryCredentialsEmail } from "../services/emailService";

jest.mock("resend", () => ({
  Resend: jest.fn(),
}));

const MockedResend = Resend as jest.MockedClass<typeof Resend>;

describe("sendTemporaryCredentialsEmail", () => {
  const originalEnv = process.env;
  const sendMock = jest.fn();
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "re_identity_test_key",
      EMAIL_FROM: "TripBuddy <accounts@tripbuddy.test>",
      FRONTEND_URL: "http://localhost:5173",
    };
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    MockedResend.mockImplementation(
      () =>
        ({
          emails: {
            send: sendMock,
          },
        } as unknown as Resend)
    );
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("sends temporary credentials with the expected sender, recipient, subject, text, and HTML", async () => {
    await sendTemporaryCredentialsEmail({
      recipientEmail: "friend@example.com",
      displayName: "Ana Traveler",
      temporaryPassword: "TempPass123!",
    });

    expect(MockedResend).toHaveBeenCalledWith("re_identity_test_key");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "TripBuddy <accounts@tripbuddy.test>",
        to: "friend@example.com",
        subject: "TripBuddy temporary login credentials",
        text: expect.stringContaining("Temporary password: TempPass123!"),
        html: expect.stringContaining("Temporary password:"),
      })
    );
  });

  it("constructs the login URL from FRONTEND_URL", async () => {
    await sendTemporaryCredentialsEmail({
      recipientEmail: "friend@example.com",
      displayName: "Ana Traveler",
      temporaryPassword: "TempPass123!",
    });

    const email = sendMock.mock.calls[0][0];
    expect(email.text).toContain("Login: http://localhost:5173/login");
    expect(email.html).toContain("http://localhost:5173/login");
  });

  it("removes trailing slashes from FRONTEND_URL", async () => {
    process.env.FRONTEND_URL = "https://tripbuddy.example.com///";

    await sendTemporaryCredentialsEmail({
      recipientEmail: "friend@example.com",
      displayName: "Ana Traveler",
      temporaryPassword: "TempPass123!",
    });

    const email = sendMock.mock.calls[0][0];
    expect(email.text).toContain("Login: https://tripbuddy.example.com/login");
    expect(email.text).not.toContain("com//login");
  });

  it("escapes all dynamic values in HTML", async () => {
    process.env.FRONTEND_URL = 'https://tripbuddy.example.com/<app>&"qa"';

    await sendTemporaryCredentialsEmail({
      recipientEmail: 'friend+<team>&"qa"@example.com',
      displayName: '<Ana & "Team">',
      temporaryPassword: `Temp<&"'>Pass`,
    });

    const email = sendMock.mock.calls[0][0];
    expect(email.html).toContain("&lt;Ana &amp; &quot;Team&quot;&gt;");
    expect(email.html).toContain(
      "friend+&lt;team&gt;&amp;&quot;qa&quot;@example.com"
    );
    expect(email.html).toContain(
      "Temp&lt;&amp;&quot;&#39;&gt;Pass"
    );
    expect(email.html).toContain(
      "https://tripbuddy.example.com/&lt;app&gt;&amp;&quot;qa&quot;/login"
    );
    expect(email.html).not.toContain('<Ana & "Team">');
    expect(email.html).not.toContain('friend+<team>&"qa"@example.com');
    expect(email.html).not.toContain(`Temp<&"'>Pass`);
    expect(email.html).not.toContain('https://tripbuddy.example.com/<app>&"qa"/login');
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendTemporaryCredentialsEmail({
        recipientEmail: "friend@example.com",
        displayName: "Ana Traveler",
        temporaryPassword: "TempPass123!",
      })
    ).rejects.toThrow("Missing required environment variable: RESEND_API_KEY");
    expect(MockedResend).not.toHaveBeenCalled();
  });

  it("throws when EMAIL_FROM is missing", async () => {
    delete process.env.EMAIL_FROM;

    await expect(
      sendTemporaryCredentialsEmail({
        recipientEmail: "friend@example.com",
        displayName: "Ana Traveler",
        temporaryPassword: "TempPass123!",
      })
    ).rejects.toThrow("Missing required environment variable: EMAIL_FROM");
    expect(MockedResend).not.toHaveBeenCalled();
  });

  it("throws when FRONTEND_URL is missing", async () => {
    delete process.env.FRONTEND_URL;

    await expect(
      sendTemporaryCredentialsEmail({
        recipientEmail: "friend@example.com",
        displayName: "Ana Traveler",
        temporaryPassword: "TempPass123!",
      })
    ).rejects.toThrow("Missing required environment variable: FRONTEND_URL");
    expect(MockedResend).not.toHaveBeenCalled();
  });

  it("throws when Resend returns an error response", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "Domain is not verified" },
    });

    await expect(
      sendTemporaryCredentialsEmail({
        recipientEmail: "friend@example.com",
        displayName: "Ana Traveler",
        temporaryPassword: "TempPass123!",
      })
    ).rejects.toThrow(
      "Failed to send temporary credentials email: Domain is not verified"
    );
  });

  it("includes the temporary password in email content but does not log it", async () => {
    await sendTemporaryCredentialsEmail({
      recipientEmail: "friend@example.com",
      displayName: "Ana Traveler",
      temporaryPassword: "TempPass123!",
    });

    const email = sendMock.mock.calls[0][0];
    expect(email.text).toContain("TempPass123!");
    expect(email.html).toContain("TempPass123!");
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("TempPass123!")
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("TempPass123!")
    );
  });
});
