import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../config/api";
import type { AuthUser } from "../types/auth";

type LoginPageProps = {
  onLogin: (token: string, user: AuthUser) => void;
  onForgotPassword: () => void;
  onVerificationRequired: (email: string) => void;
  notice?: string;
};

type LoginResponse = {
  token?: string;
  user?: AuthUser;
  message?: string;
};

function LoginPage({
  onLogin,
  onForgotPassword,
  onVerificationRequired,
  notice,
}: LoginPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as LoginResponse;

      if (
        response.status === 403 &&
        data.message === "Email verification required"
      ) {
        onVerificationRequired(email.trim().toLowerCase());
        return;
      }

      if (!response.ok || !data.token || !data.user) {
        setError(data.message ?? t("auth.loginFailed"));
        return;
      }

      onLogin(data.token, data.user);
    } catch {
      setError(t("auth.loginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <div>
        <p className="eyebrow">{t("auth.welcomeBack")}</p>
        <h2>{t("auth.login")}</h2>
      </div>

      {notice ? <p className="success">{notice}</p> : null}

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          {t("common.email")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          {t("common.password")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.loggingIn") : t("auth.login")}
        </button>
      </form>

      <button
        className="link-button auth-switch"
        type="button"
        onClick={onForgotPassword}
      >
        {t("auth.forgotPassword")}
      </button>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export default LoginPage;
