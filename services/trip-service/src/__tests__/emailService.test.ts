import { Resend } from "resend";
import { sendInvitationEmail } from "../services/emailService";

jest.mock("resend", () => ({
  Resend: jest.fn(),
}));

const MockedResend = Resend as jest.MockedClass<typeof Resend>;

describe("sendInvitationEmail", () => {
  const originalEnv = process.env;
  const sendMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "TripBuddy <invites@tripbuddy.test>",
      FRONTEND_URL: "http://localhost:5173",
    };

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
  });

  it("sends an invitation email with the expected recipient, sender, subject, text, and HTML", async () => {
    await sendInvitationEmail({
      recipientEmail: "friend@example.com",
      inviterName: "Ana Traveler",
      tripName: "Lisbon Spring",
      inviteToken: "invite-token",
    });

    expect(MockedResend).toHaveBeenCalledWith("re_test_key");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "TripBuddy <invites@tripbuddy.test>",
        to: "friend@example.com",
        subject: "TripBuddy invitation: Lisbon Spring",
        text: expect.stringContaining(
          'Ana Traveler invited you to join "Lisbon Spring" on TripBuddy.'
        ),
        html: expect.stringContaining("Accept invitation"),
      })
    );
  });

  it("constructs the expected invitation URL", async () => {
    await sendInvitationEmail({
      recipientEmail: "friend@example.com",
      inviterName: "Ana Traveler",
      tripName: "Lisbon Spring",
      inviteToken: "token with spaces",
    });

    const email = sendMock.mock.calls[0][0];
    expect(email.text).toContain(
      "http://localhost:5173/invites/token%20with%20spaces/accept"
    );
    expect(email.html).toContain(
      "http://localhost:5173/invites/token%20with%20spaces/accept"
    );
  });

  it("removes trailing slashes from FRONTEND_URL", async () => {
    process.env.FRONTEND_URL = "https://tripbuddy.example.com///";

    await sendInvitationEmail({
      recipientEmail: "friend@example.com",
      inviterName: "Ana Traveler",
      tripName: "Lisbon Spring",
      inviteToken: "invite-token",
    });

    const email = sendMock.mock.calls[0][0];
    expect(email.text).toContain(
      "https://tripbuddy.example.com/invites/invite-token/accept"
    );
    expect(email.text).not.toContain("com//invites");
  });

  it("escapes dynamic values in HTML", async () => {
    await sendInvitationEmail({
      recipientEmail: "friend@example.com",
      inviterName: '<Ana & "Team">',
      tripName: "Paris <Summer> & Friends",
      inviteToken: "token&value",
    });

    const email = sendMock.mock.calls[0][0];
    expect(email.html).toContain("&lt;Ana &amp; &quot;Team&quot;&gt;");
    expect(email.html).toContain("Paris &lt;Summer&gt; &amp; Friends");
    expect(email.html).toContain("token%26value");
    expect(email.html).not.toContain('<Ana & "Team">');
    expect(email.html).not.toContain("Paris <Summer> & Friends");
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendInvitationEmail({
        recipientEmail: "friend@example.com",
        inviterName: "Ana Traveler",
        tripName: "Lisbon Spring",
        inviteToken: "invite-token",
      })
    ).rejects.toThrow("Missing required environment variable: RESEND_API_KEY");
    expect(MockedResend).not.toHaveBeenCalled();
  });

  it("throws when EMAIL_FROM is missing", async () => {
    delete process.env.EMAIL_FROM;

    await expect(
      sendInvitationEmail({
        recipientEmail: "friend@example.com",
        inviterName: "Ana Traveler",
        tripName: "Lisbon Spring",
        inviteToken: "invite-token",
      })
    ).rejects.toThrow("Missing required environment variable: EMAIL_FROM");
    expect(MockedResend).not.toHaveBeenCalled();
  });

  it("throws when FRONTEND_URL is missing", async () => {
    delete process.env.FRONTEND_URL;

    await expect(
      sendInvitationEmail({
        recipientEmail: "friend@example.com",
        inviterName: "Ana Traveler",
        tripName: "Lisbon Spring",
        inviteToken: "invite-token",
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
      sendInvitationEmail({
        recipientEmail: "friend@example.com",
        inviterName: "Ana Traveler",
        tripName: "Lisbon Spring",
        inviteToken: "invite-token",
      })
    ).rejects.toThrow(
      "Failed to send invitation email: Domain is not verified"
    );
  });
});
