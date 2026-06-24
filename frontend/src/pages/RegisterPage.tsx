import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";

type RegisterPageProps = {
  onBackToLogin: () => void;
};

type RegisterResponse = {
  message?: string;
};

function RegisterPage({ onBackToLogin }: RegisterPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        setError(data.message ?? "Registration failed");
        return;
      }

      setEmail("");
      setPassword("");
      setSuccess(data.message ?? "Registration successful. You can now log in.");
      onBackToLogin();
    } catch {
      setError("Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <div>
        <p className="eyebrow">Start planning</p>
        <h2>Register</h2>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}

      <button className="link-button" type="button" onClick={onBackToLogin}>
        Back to login
      </button>
    </section>
  );
}

export default RegisterPage;