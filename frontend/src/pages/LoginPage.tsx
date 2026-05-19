import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";

type LoginPageProps = {
  onLogin: (token: string) => void;
};

type LoginResponse = {
  token?: string;
  message?: string;
};

function LoginPage({ onLogin }: LoginPageProps) {
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

      if (!response.ok || !data.token) {
        setError(data.message ?? "Login failed");
        return;
      }

      onLogin(data.token);
    } catch {
      setError("Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page auth-card">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h2>Login</h2>
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
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export default LoginPage;