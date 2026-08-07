import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../config/api";

type ForgotPasswordPageProps = {
  onBackToLogin: () => void;
};

function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message || t("auth.resetRequestFailed"));
        return;
      }

      setSuccessMessage(
        data.message ||
          t("auth.resetRequestSuccess")
      );
    } catch {
      setError(t("auth.resetRequestFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <div>
        <p className="eyebrow">{t("auth.accountRecovery")}</p>
        <h2>{t("auth.forgotPasswordTitle")}</h2>
        <p>{t("auth.forgotPasswordDescription")}</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          {t("common.email")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.sending") : t("auth.sendResetLink")}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {successMessage ? <p className="success">{successMessage}</p> : null}

      <button className="link-button auth-switch" type="button" onClick={onBackToLogin}>
        {t("common.backToLogin")}
      </button>
    </section>
  );
}

export default ForgotPasswordPage;
