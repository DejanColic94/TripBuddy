import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedToken = resetToken.trim();

    if (!trimmedToken) {
      setError(t("auth.invalidResetLink"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("auth.newPasswordMin"));
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setError(t("auth.newPasswordMaxBytes"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.newPasswordsMismatch"));
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
        setError(data.message || t("auth.resetFailed"));
        return;
      }

      onResetSuccess();
    } catch {
      setError(t("auth.resetFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="brand-panel">
        <p className="eyebrow">{t("common.appName")}</p>
        <h1>{t("auth.choosePassword")}</h1>
        <p>{t("auth.resetLinkDescription")}</p>
      </div>

      <div className="auth-column">
        <section className="page auth-card">
          <div>
            <p className="eyebrow">{t("auth.accountRecovery")}</p>
            <h2>{t("auth.resetPassword")}</h2>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              {t("auth.newPassword")}
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
              {t("auth.confirmNewPassword")}
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
              {isSubmitting ? t("auth.resetting") : t("auth.resetPassword")}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}

          <button className="link-button auth-switch" type="button" onClick={onBackToLogin}>
            {t("common.backToLogin")}
          </button>
        </section>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
