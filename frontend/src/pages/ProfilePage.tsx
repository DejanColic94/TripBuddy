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
            <input value={currentUser.email} readOnly />
          </label>

          <label>
            Role
            <input value={currentUser.role} readOnly />
          </label>

          {error ? <p className="error">{error}</p> : null}
          {successMessage ? <p className="success">{successMessage}</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>
    </section>
  );
}

export default ProfilePage;
