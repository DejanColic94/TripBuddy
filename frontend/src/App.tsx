import { useState } from "react";
import "./App.css";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TripDetailsPage from "./pages/TripDetailsPage";
import TripsPage from "./pages/TripsPage";
import type { Trip } from "./types/trip";

function getInviteTokenFromPath(pathname: string) {
  const match = pathname.match(/^\/invites\/([^/]+)\/accept\/?$/);

  return match ? decodeURIComponent(match[1]) : null;
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [authPage, setAuthPage] = useState<"login" | "register">("login");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [inviteToken, setInviteToken] = useState(() => getInviteTokenFromPath(window.location.pathname));

  const handleLogin = (nextToken: string) => {
    localStorage.setItem("token", nextToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setSelectedTrip(null);
    setToken(null);
  };

  const handleBackToTrips = () => {
    window.history.pushState({}, "", "/");
    setInviteToken(null);
    setSelectedTrip(null);
  };

  return (
    <main className="app">
      {token ? (
        inviteToken ? (
          <AcceptInvitePage
            token={token}
            inviteToken={inviteToken}
            onBackToTrips={handleBackToTrips}
            onUnauthorized={handleLogout}
          />
        ) : selectedTrip ? (
          <TripDetailsPage
            token={token}
            trip={selectedTrip}
            onBack={() => setSelectedTrip(null)}
            onUnauthorized={handleLogout}
          />
        ) : (
          <TripsPage
            token={token}
            onUnauthorized={handleLogout}
            onSelectTrip={setSelectedTrip}
          />
        )
      ) : authPage === "register" ? (
        <div className="auth-layout">
          <div className="brand-panel">
            <p className="eyebrow">TripBuddy</p>
            <h1>Plan lighter, travel better.</h1>
            <p>Keep your next escapes organized with calm, simple trip planning.</p>
          </div>
          <div className="auth-column">
            <RegisterPage onBackToLogin={() => setAuthPage("login")} />
          </div>
        </div>
      ) : (
        <div className="auth-layout">
          <div className="brand-panel">
            <p className="eyebrow">TripBuddy</p>
            <h1>Plan lighter, travel better.</h1>
            <p>Keep your next escapes organized with calm, simple trip planning.</p>
          </div>
          <div className="auth-column">
            <LoginPage onLogin={handleLogin} />
            <button
              className="link-button auth-switch"
              type="button"
              onClick={() => setAuthPage("register")}
            >
              Create account
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
