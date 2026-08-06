import { useState, type FormEvent } from "react";
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
      setError("Name is required");
      return;
    }

    if (normalizedName.length > 255) {
      setError("Name must be 255 characters or fewer");
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
          ("message" in data && data.message) || "Failed to update profile"
        );
        return;
      }

      setName(data.user.name);
      onUserUpdated(data.token, data.user);
      setSuccessMessage("Profile updated");
    } catch {
      setError("Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccessMessage("");

    if (!passwordCurrent) {
      setPasswordError("Current password is required");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setPasswordError("New password must be 72 bytes or fewer");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
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
        setPasswordError(data.message || "Failed to update password");
        return;
      }

      setPasswordCurrent("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccessMessage("Password updated");
    } catch {
      setPasswordError("Failed to update password");
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <section className="page profile-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>My Profile</h1>
          <p className="page-subtitle">Keep your TripBuddy identity up to date.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to trips
        </button>
      </div>

      <section className="panel profile-card">
        <h2>Profile details</h2>
        <p className="page-subtitle">Edit the name other travelers see.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              value={name}
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label>
            Email
            <input
              aria-label="Email"
              value={currentUser.email}
              readOnly
              aria-readonly="true"
            />
            <small>Your email is your permanent sign-in identifier.</small>
          </label>

          {error ? <p className="error">{error}</p> : null}
          {successMessage ? <p className="success">{successMessage}</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>

      <section className="panel profile-card">
        <h2>Change password</h2>
        <p className="page-subtitle">
          Use at least 8 characters and confirm your current password.
        </p>

        <form className="form-stack" onSubmit={handlePasswordSubmit}>
          <label>
            Current password for password change
            <input
              type="password"
              value={passwordCurrent}
              onChange={(event) => setPasswordCurrent(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

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

          {passwordError ? <p className="error">{passwordError}</p> : null}
          {passwordSuccessMessage ? (
            <p className="success">{passwordSuccessMessage}</p>
          ) : null}

          <button
            className="primary-button"
            type="submit"
            disabled={isPasswordSubmitting}
          >
            {isPasswordSubmitting ? "Changing password..." : "Change password"}
          </button>
        </form>
      </section>
    </section>
  );
}

export default ProfilePage;
