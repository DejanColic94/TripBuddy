import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";

type ResetPasswordPageProps = {
  resetToken: string;
  onBackToLogin: () => void;
  onResetSuccess: () => void;
};

function ResetPasswordPage({
  resetToken,
  onBackToLogin,
  onResetSuccess,
}: ResetPasswordPageProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedToken = resetToken.trim();

    if (!trimmedToken) {
      setError("Reset link is invalid or has expired");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("New password must be 72 bytes or fewer");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: trimmedToken,
          newPassword,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message || "Failed to reset password");
        return;
      }

      onResetSuccess();
    } catch {
      setError("Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="brand-panel">
        <p className="eyebrow">TripBuddy</p>
        <h1>Choose a new password.</h1>
        <p>Your reset link can be used only once and expires after 30 minutes.</p>
      </div>

      <div className="auth-column">
        <section className="page auth-card">
          <div>
            <p className="eyebrow">Account recovery</p>
            <h2>Reset password</h2>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Reset password"}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}

          <button className="link-button auth-switch" type="button" onClick={onBackToLogin}>
            Back to login
          </button>
        </section>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
