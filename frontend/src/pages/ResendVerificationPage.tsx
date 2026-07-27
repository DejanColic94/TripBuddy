import { useState } from "react";
import { API_BASE_URL } from "../config/api";

type Props = { email: string; onBackToLogin: () => void };

function ResendVerificationPage({ email, onBackToLogin }: Props) {
  const [message, setMessage] = useState("Verify your email before logging in.");
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
          ? data.message || "Verification link requested"
          : data.message || "Failed to request verification"
      );
    } catch {
      setMessage("Failed to request verification");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <p className="eyebrow">Account verification</p>
      <h2>Check your email</h2>
      <p>{message}</p>
      <button className="primary-button" type="button" onClick={resend} disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Resend verification email"}
      </button>
      <button className="link-button auth-switch" type="button" onClick={onBackToLogin}>
        Back to login
      </button>
    </section>
  );
}

export default ResendVerificationPage;
