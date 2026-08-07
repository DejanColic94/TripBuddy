import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../config/api";

type RegisterPageProps = {
  onBackToLogin: () => void;
  onRegistrationSuccess: (message: string) => void;
};

type RegisterResponse = {
  message?: string;
};

function RegisterPage({
  onBackToLogin,
  onRegistrationSuccess,
}: RegisterPageProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      setError(t("validation.nameRequired"));
      return;
    }

    if (normalizedName.length > 255) {
      setError(t("validation.nameTooLong"));
      return;
    }

    if (password.length < 8) {
      setError(t("validation.passwordMin"));
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError(t("validation.passwordMaxBytes"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("validation.passwordsMismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          password,
        }),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        setError(data.message ?? t("auth.registrationFailed"));
        return;
      }

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      const successMessage =
        data.message ?? t("auth.registrationSuccess");
      setSuccess(successMessage);
      onRegistrationSuccess(successMessage);
    } catch {
      setError(t("auth.registrationFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <div>
        <p className="eyebrow">{t("auth.startPlanning")}</p>
        <h2>{t("auth.register")}</h2>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          {t("common.name")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            autoComplete="name"
            required
          />
        </label>

        <label>
          {t("common.email")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={255}
            autoComplete="email"
            required
          />
        </label>

        <label>
          {t("common.password")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>

        <label>
          {t("auth.confirmPassword")}
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.registering") : t("auth.register")}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}

      <button className="link-button" type="button" onClick={onBackToLogin}>
        {t("common.backToLogin")}
      </button>
    </section>
  );
}

export default RegisterPage;
