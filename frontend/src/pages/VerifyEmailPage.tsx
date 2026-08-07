import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../config/api";

type Props = { verificationToken: string; onBackToLogin: (notice?: string) => void };

function VerifyEmailPage({ verificationToken, onBackToLogin }: Props) {
  const { t } = useTranslation();
  const hasVerificationToken = Boolean(verificationToken.trim());
  const [error, setError] = useState(() => hasVerificationToken ? "" : t("auth.invalidVerificationLink"));
  const [isLoading, setIsLoading] = useState(hasVerificationToken);

  useEffect(() => {
    let active = true;

    async function verify() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: verificationToken.trim() }),
        });
        const data = (await response.json()) as { message?: string };

        if (!active) return;
        if (!response.ok) {
          setError(data.message || t("auth.verificationFailed"));
          setIsLoading(false);
          return;
        }
        onBackToLogin(t("auth.verificationSuccess"));
      } catch {
        if (active) {
          setError(t("auth.verificationFailed"));
          setIsLoading(false);
        }
      }
    }

    if (verificationToken.trim()) {
      void verify();
    }
    return () => {
      active = false;
    };
  }, [onBackToLogin, t, verificationToken]);

  return (
    <section className="page auth-card">
      <p className="eyebrow">{t("auth.accountVerification")}</p>
      <h2>{t("auth.verifyEmail")}</h2>
      {isLoading ? <p className="loading-state">{t("auth.verifyingEmail")}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {error ? (
        <button className="secondary-button" type="button" onClick={() => onBackToLogin()}>
          {t("common.backToLogin")}
        </button>
      ) : null}
    </section>
  );
}

export default VerifyEmailPage;
