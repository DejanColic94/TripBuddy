import { useState } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import TripsPage from "./pages/TripsPage";

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

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
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </main>
  );
}

export default App;
