import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";

type ForgotPasswordPageProps = {
  onBackToLogin: () => void;
};

function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
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
        setError(data.message || "Failed to request password reset");
        return;
      }

      setSuccessMessage(
        data.message ||
          "If an account exists for that email, a reset link has been sent"
      );
    } catch {
      setError("Failed to request password reset");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <div>
        <p className="eyebrow">Account recovery</p>
        <h2>Forgot password</h2>
        <p>Enter your email and we’ll send a reset link if an account exists.</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {successMessage ? <p className="success">{successMessage}</p> : null}

      <button className="link-button auth-switch" type="button" onClick={onBackToLogin}>
        Back to login
      </button>
    </section>
  );
}

export default ForgotPasswordPage;
