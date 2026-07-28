import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

type Props = { verificationToken: string; onBackToLogin: (notice?: string) => void };

function VerifyEmailPage({ verificationToken, onBackToLogin }: Props) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
          setError(data.message || "Failed to verify email");
          setIsLoading(false);
          return;
        }
        onBackToLogin("Email verified successfully. You can now log in.");
      } catch {
        if (active) {
          setError("Failed to verify email");
          setIsLoading(false);
        }
      }
    }

    if (!verificationToken.trim()) {
      setError("Verification link is invalid or has expired");
      setIsLoading(false);
    } else {
      void verify();
    }
    return () => {
      active = false;
    };
  }, [onBackToLogin, verificationToken]);

  return (
    <section className="page auth-card">
      <p className="eyebrow">Account verification</p>
      <h2>Verify email</h2>
      {isLoading ? <p className="loading-state">Verifying your email...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {error ? (
        <button className="secondary-button" type="button" onClick={() => onBackToLogin()}>
          Back to login
        </button>
      ) : null}
    </section>
  );
}

export default VerifyEmailPage;
