import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../config/api";
import type { AuthUser } from "../types/auth";

type ProfilePageProps = {
  token: string;
  currentUser: AuthUser;
  onBack: () => void;
  onUnauthorized: () => void;
  onUserUpdated: (token: string, user: AuthUser) => void;
};

type ProfileResponse =
  | { token: string; user: AuthUser }
  | { message?: string };

function ProfilePage({
  token,
  currentUser,
  onBack,
  onUnauthorized,
  onUserUpdated,
}: ProfilePageProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(currentUser.name);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const normalizedName = name.trim();

    if (!normalizedName) {
      setError(t("validation.nameRequired"));
      return;
    }

    if (normalizedName.length > 255) {
      setError(t("validation.nameTooLong"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: normalizedName }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as ProfileResponse;

      if (
        !response.ok ||
        !("user" in data) ||
        !("token" in data) ||
        typeof data.token !== "string"
      ) {
        setError(
          ("message" in data && data.message) || t("profile.updateFailed")
        );
        return;
      }

      setName(data.user.name);
      onUserUpdated(data.token, data.user);
      setSuccessMessage(t("profile.updated"));
    } catch {
      setError(t("profile.updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccessMessage("");

    if (!passwordCurrent) {
      setPasswordError(t("validation.currentPasswordRequired"));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t("auth.newPasswordMin"));
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setPasswordError(t("auth.newPasswordMaxBytes"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("auth.newPasswordsMismatch"));
      return;
    }

    setIsPasswordSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/password`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordCurrent,
          newPassword,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setPasswordError(data.message || t("profile.passwordUpdateFailed"));
        return;
      }

      setPasswordCurrent("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccessMessage(t("profile.passwordUpdated"));
    } catch {
      setPasswordError(t("profile.passwordUpdateFailed"));
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <section className="page profile-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t("profile.eyebrow")}</p>
          <h1>{t("profile.title")}</h1>
          <p className="page-subtitle">{t("profile.subtitle")}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          {t("common.backToTrips")}
        </button>
      </div>

      <section className="panel profile-card">
        <h2>{t("profile.details")}</h2>
        <p className="page-subtitle">{t("profile.detailsDescription")}</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            {t("common.name")}
            <input
              value={name}
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label>
            {t("common.email")}
            <input
              aria-label={t("common.email")}
              value={currentUser.email}
              readOnly
              aria-readonly="true"
            />
            <small>{t("profile.permanentEmail")}</small>
          </label>

          {error ? <p className="error">{error}</p> : null}
          {successMessage ? <p className="success">{successMessage}</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("profile.save")}
          </button>
        </form>
      </section>

      <section className="panel profile-card">
        <h2>{t("profile.changePassword")}</h2>
        <p className="page-subtitle">{t("profile.passwordRules")}</p>

        <form className="form-stack" onSubmit={handlePasswordSubmit}>
          <label>
            {t("profile.currentPasswordForChange")}
            <input
              type="password"
              value={passwordCurrent}
              onChange={(event) => setPasswordCurrent(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

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

          {passwordError ? <p className="error">{passwordError}</p> : null}
          {passwordSuccessMessage ? (
            <p className="success">{passwordSuccessMessage}</p>
          ) : null}

          <button
            className="primary-button"
            type="submit"
            disabled={isPasswordSubmitting}
          >
            {isPasswordSubmitting ? t("profile.changingPassword") : t("profile.changePassword")}
          </button>
        </form>
      </section>
    </section>
  );
}

export default ProfilePage;
