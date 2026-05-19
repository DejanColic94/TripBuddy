import { useState, type FormEvent } from "react";

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
      const response = await fetch("http://localhost:4000/auth/register", {
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

      setSuccess(data.message ?? "Registration successful. You can now log in.");
      setEmail("");
      setPassword("");
    } catch {
      setError("Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page">
      <h1>Register</h1>

      <form onSubmit={handleSubmit}>
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

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}

      <button type="button" onClick={onBackToLogin}>
        Back to login
      </button>
    </section>
  );
}

export default RegisterPage;