import { Resend } from "resend";

export type SendTemporaryCredentialsEmailInput = {
  recipientEmail: string;
  displayName: string;
  temporaryPassword: string;
};

export type SendPasswordResetEmailInput = {
  recipientEmail: string;
  displayName: string;
  resetToken: string;
};

export type SendEmailVerificationInput = {
  recipientEmail: string;
  displayName: string;
  verificationToken: string;
};

export type SendEmailChangeVerificationInput = SendEmailVerificationInput;

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

function buildPasswordResetUrl(frontendUrl: string, resetToken: string): string {
  return `${frontendUrl.replace(/\/+$/, "")}/reset-password/${encodeURIComponent(
    resetToken
  )}`;
}

function buildEmailVerificationUrl(
  frontendUrl: string,
  verificationToken: string
): string {
  return `${frontendUrl.replace(/\/+$/, "")}/verify-email/${encodeURIComponent(
    verificationToken
  )}`;
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

export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput
): Promise<void> {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const emailFrom = getRequiredEnv("EMAIL_FROM");
  const frontendUrl = getRequiredEnv("FRONTEND_URL");
  const resetUrl = buildPasswordResetUrl(frontendUrl, input.resetToken);
  const subject = "Reset your TripBuddy password";

  const text = [
    `Hello ${input.displayName},`,
    "",
    "Use the link below to reset your TripBuddy password.",
    "This link expires in 30 minutes and can be used only once.",
    "",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const escapedDisplayName = escapeHtml(input.displayName);
  const escapedResetUrl = escapeHtml(resetUrl);
  const html = `
    <div>
      <p>Hello ${escapedDisplayName},</p>
      <p>Use the link below to reset your TripBuddy password.</p>
      <p>This link expires in 30 minutes and can be used only once.</p>
      <p>
        <a href="${escapedResetUrl}" style="display:inline-block;padding:12px 18px;background:#256d5a;color:#ffffff;text-decoration:none;border-radius:6px;">
          Reset password
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${escapedResetUrl}">${escapedResetUrl}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
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
    throw new Error(`Failed to send password reset email: ${result.error.message}`);
  }
}

export async function sendEmailVerification(
  input: SendEmailVerificationInput
): Promise<void> {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const emailFrom = getRequiredEnv("EMAIL_FROM");
  const frontendUrl = getRequiredEnv("FRONTEND_URL");
  const verificationUrl = buildEmailVerificationUrl(
    frontendUrl,
    input.verificationToken
  );
  const subject = "Verify your TripBuddy email";
  const text = [
    `Hello ${input.displayName},`,
    "",
    "Verify your email address to finish setting up your TripBuddy account.",
    "This link expires in 24 hours and can be used only once.",
    "",
    verificationUrl,
  ].join("\n");
  const escapedDisplayName = escapeHtml(input.displayName);
  const escapedVerificationUrl = escapeHtml(verificationUrl);
  const html = `
    <div>
      <p>Hello ${escapedDisplayName},</p>
      <p>Verify your email address to finish setting up your TripBuddy account.</p>
      <p>This link expires in 24 hours and can be used only once.</p>
      <p>
        <a href="${escapedVerificationUrl}" style="display:inline-block;padding:12px 18px;background:#256d5a;color:#ffffff;text-decoration:none;border-radius:6px;">
          Verify email
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${escapedVerificationUrl}">${escapedVerificationUrl}</a></p>
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
      `Failed to send email verification: ${result.error.message}`
    );
  }
}

export async function sendEmailChangeVerification(
  input: SendEmailChangeVerificationInput
): Promise<void> {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const emailFrom = getRequiredEnv("EMAIL_FROM");
  const frontendUrl = getRequiredEnv("FRONTEND_URL");
  const verificationUrl = buildEmailVerificationUrl(
    frontendUrl,
    input.verificationToken
  );
  const subject = "Confirm your new TripBuddy email";
  const text = [
    `Hello ${input.displayName},`,
    "",
    "Confirm this email address to use it for your TripBuddy account.",
    "Your current email remains active until you confirm this change.",
    "This link expires in 24 hours and can be used only once.",
    "",
    verificationUrl,
  ].join("\n");
  const escapedDisplayName = escapeHtml(input.displayName);
  const escapedVerificationUrl = escapeHtml(verificationUrl);
  const html = `
    <div>
      <p>Hello ${escapedDisplayName},</p>
      <p>Confirm this email address to use it for your TripBuddy account.</p>
      <p>Your current email remains active until you confirm this change.</p>
      <p>This link expires in 24 hours and can be used only once.</p>
      <p>
        <a href="${escapedVerificationUrl}" style="display:inline-block;padding:12px 18px;background:#256d5a;color:#ffffff;text-decoration:none;border-radius:6px;">
          Confirm new email
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${escapedVerificationUrl}">${escapedVerificationUrl}</a></p>
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
      `Failed to send email change verification: ${result.error.message}`
    );
  }
}
