import { Resend } from "resend";

export type SendTemporaryCredentialsEmailInput = {
  recipientEmail: string;
  displayName: string;
  temporaryPassword: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoginUrl(frontendUrl: string): string {
  return `${frontendUrl.replace(/\/+$/, "")}/login`;
}

export async function sendTemporaryCredentialsEmail(
  input: SendTemporaryCredentialsEmailInput
): Promise<void> {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const emailFrom = getRequiredEnv("EMAIL_FROM");
  const frontendUrl = getRequiredEnv("FRONTEND_URL");
  const loginUrl = buildLoginUrl(frontendUrl);
  const subject = "TripBuddy temporary login credentials";

  const text = [
    `Hello ${input.displayName},`,
    "",
    "A TripBuddy account was created for you so you can access your trip invitation.",
    "",
    `Email: ${input.recipientEmail}`,
    `Temporary password: ${input.temporaryPassword}`,
    `Login: ${loginUrl}`,
    "",
    "This password is temporary. Please change it after you log in.",
  ].join("\n");

  const escapedDisplayName = escapeHtml(input.displayName);
  const escapedRecipientEmail = escapeHtml(input.recipientEmail);
  const escapedTemporaryPassword = escapeHtml(input.temporaryPassword);
  const escapedLoginUrl = escapeHtml(loginUrl);

  const html = `
    <div>
      <p>Hello ${escapedDisplayName},</p>
      <p>A TripBuddy account was created for you so you can access your trip invitation.</p>
      <p><strong>Email:</strong> ${escapedRecipientEmail}</p>
      <p><strong>Temporary password:</strong> ${escapedTemporaryPassword}</p>
      <p>
        <a href="${escapedLoginUrl}" style="display:inline-block;padding:12px 18px;background:#256d5a;color:#ffffff;text-decoration:none;border-radius:6px;">
          Log in to TripBuddy
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${escapedLoginUrl}">${escapedLoginUrl}</a></p>
      <p>This password is temporary. Please change it after you log in.</p>
    </div>
  `;

  const resend = new Resend(resendApiKey);
  const result = await resend.emails.send({
    from: emailFrom,
    to: input.recipientEmail,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(
      `Failed to send temporary credentials email: ${result.error.message}`
    );
  }
}
