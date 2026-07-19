import { Resend } from "resend";

export type SendInvitationEmailInput = {
  recipientEmail: string;
  inviterName: string;
  tripName: string;
  inviteToken: string;
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

function buildInvitationUrl(frontendUrl: string, inviteToken: string): string {
  const normalizedFrontendUrl = frontendUrl.replace(/\/+$/, "");
  return `${normalizedFrontendUrl}/invites/${encodeURIComponent(
    inviteToken
  )}/accept`;
}

export async function sendInvitationEmail(
  input: SendInvitationEmailInput
): Promise<void> {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const emailFrom = getRequiredEnv("EMAIL_FROM");
  const frontendUrl = getRequiredEnv("FRONTEND_URL");
  const invitationUrl = buildInvitationUrl(frontendUrl, input.inviteToken);
  const subject = `TripBuddy invitation: ${input.tripName}`;

  const text = [
    `${input.inviterName} invited you to join "${input.tripName}" on TripBuddy.`,
    "",
    "Accept invitation:",
    invitationUrl,
  ].join("\n");

  const escapedInviterName = escapeHtml(input.inviterName);
  const escapedTripName = escapeHtml(input.tripName);
  const escapedInvitationUrl = escapeHtml(invitationUrl);

  const html = `
    <div>
      <p>${escapedInviterName} invited you to join <strong>${escapedTripName}</strong> on TripBuddy.</p>
      <p>
        <a href="${escapedInvitationUrl}" style="display:inline-block;padding:12px 18px;background:#256d5a;color:#ffffff;text-decoration:none;border-radius:6px;">
          Accept invitation
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${escapedInvitationUrl}">${escapedInvitationUrl}</a></p>
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
    throw new Error(`Failed to send invitation email: ${result.error.message}`);
  }
}
