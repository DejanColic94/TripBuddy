import { useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../config/api";

type Props = { email: string; onBackToLogin: () => void };

function ResendVerificationPage({ email, onBackToLogin }: Props) {
  const { t } = useTranslation();
  const [message, setMessage] = useState(() => t("auth.verificationRequired"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resend = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(
        response.ok
          ? data.message || t("auth.verificationRequested")
          : data.message || t("auth.verificationRequestFailed")
      );
    } catch {
      setMessage(t("auth.verificationRequestFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <p className="eyebrow">{t("auth.accountVerification")}</p>
      <h2>{t("auth.checkEmail")}</h2>
      <p>{message}</p>
      <button className="primary-button" type="button" onClick={resend} disabled={isSubmitting}>
        {isSubmitting ? t("auth.sending") : t("auth.resendVerification")}
      </button>
      <button className="link-button auth-switch" type="button" onClick={onBackToLogin}>
        {t("common.backToLogin")}
      </button>
    </section>
  );
}

export default ResendVerificationPage;
