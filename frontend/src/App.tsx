import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { API_BASE_URL } from "./config/api";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TripDetailsPage from "./pages/TripDetailsPage";
import TripsPage from "./pages/TripsPage";
import type { AuthUser } from "./types/auth";
import type { Trip } from "./types/trip";

function getInviteTokenFromPath(pathname: string) {
  const match = pathname.match(/^\/invites\/([^/]+)\/accept\/?$/);

  return match ? decodeURIComponent(match[1]) : null;
}

function getStoredUser() {
  const storedUser = localStorage.getItem("user");

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser);
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState(
    () => Boolean(localStorage.getItem("token") && !localStorage.getItem("user"))
  );
  const [authPage, setAuthPage] = useState<"login" | "register">("login");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [inviteToken, setInviteToken] = useState(() => getInviteTokenFromPath(window.location.pathname));

  const handleLogin = (nextToken: string, user: AuthUser) => {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(user));
    setCurrentUser(user);
    setToken(nextToken);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setSelectedTrip(null);
    setToken(null);
    setIsAuthBootstrapping(false);
  }, []);

  useEffect(() => {
    if (!token || currentUser) {
      setIsAuthBootstrapping(false);
      return;
    }

    let isCancelled = false;

    async function restoreUser() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const user = (await response.json()) as AuthUser;

        if (
          !response.ok ||
          typeof user.id !== "number" ||
          typeof user.name !== "string" ||
          typeof user.email !== "string" ||
          typeof user.role !== "string"
        ) {
          throw new Error("Failed to restore session");
        }

        if (!isCancelled) {
          localStorage.setItem("user", JSON.stringify(user));
          setCurrentUser(user);
          setIsAuthBootstrapping(false);
        }
      } catch {
        if (!isCancelled) {
          handleLogout();
        }
      }
    }

    void restoreUser();

    return () => {
      isCancelled = true;
    };
  }, [currentUser, handleLogout, token]);

  const handleBackToTrips = () => {
    window.history.pushState({}, "", "/");
    setInviteToken(null);
    setSelectedTrip(null);
  };

  return (
    <main className="app">
      {isAuthBootstrapping ? (
        <p className="loading-state">Restoring your session...</p>
      ) : token ? (
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
            canManage={currentUser?.id === selectedTrip.createdBy}
            onBack={() => setSelectedTrip(null)}
            onTripUpdated={setSelectedTrip}
            onTripDeleted={() => setSelectedTrip(null)}
            onUnauthorized={handleLogout}
          />
        ) : (
          <TripsPage
            token={token}
            currentUser={currentUser}
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
