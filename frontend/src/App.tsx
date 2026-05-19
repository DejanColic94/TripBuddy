import { useState } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TripsPage from "./pages/TripsPage";

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [authPage, setAuthPage] = useState<"login" | "register">("login");

  const handleLogin = (nextToken: string) => {
    localStorage.setItem("token", nextToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  return (
    <main className="app">
      {token ? (
        <TripsPage token={token} onUnauthorized={handleLogout} />
      ) : authPage === "register" ? (
        <RegisterPage onBackToLogin={() => setAuthPage("login")} />
      ) : (
        <>
          <LoginPage onLogin={handleLogin} />
          <button type="button" onClick={() => setAuthPage("register")}>
            Create account
          </button>
        </>
      )}
    </main>
  );
}

export default App;
