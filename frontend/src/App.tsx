import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { API_BASE_URL } from "./config/api";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import GuestTripPage from "./pages/GuestTripPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ResendVerificationPage from "./pages/ResendVerificationPage";
import TripDetailsPage from "./pages/TripDetailsPage";
import TripsPage from "./pages/TripsPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import type { AuthUser } from "./types/auth";
import { getUserTripRole, type Trip } from "./types/trip";

function getInviteTokenFromPath(pathname: string) {
  const match =
    pathname.match(/^\/invite\/([^/]+)\/?$/) ||
    pathname.match(/^\/invites\/([^/]+)\/accept\/?$/);

  return match ? decodeURIComponent(match[1]) : null;
}

function getPasswordResetTokenFromPath(pathname: string) {
  const match = pathname.match(/^\/reset-password\/([^/]+)\/?$/);

  return match ? decodeURIComponent(match[1]) : null;
}

function getVerificationTokenFromPath(pathname: string) {
  const match = pathname.match(/^\/verify-email\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getGuestTokenFromPath(pathname: string) {
  const match = pathname.match(/^\/guest\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getSafeRedirect(search: string) {
  const redirect = new URLSearchParams(search).get("redirect");

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return null;
  }

  return redirect;
}

function getOpenTripId(search: string) {
  const value = new URLSearchParams(search).get("openTrip");
  const tripId = value ? Number(value) : NaN;

  return Number.isInteger(tripId) && tripId > 0 ? tripId : null;
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
  const [authPage, setAuthPage] = useState<
    "login" | "register" | "forgot-password" | "resend-verification"
  >("login");
  const [authNotice, setAuthNotice] = useState("");
  const [appPage, setAppPage] = useState<"trips" | "profile">("trips");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [inviteToken, setInviteToken] = useState(() => getInviteTokenFromPath(window.location.pathname));
  const [passwordResetToken, setPasswordResetToken] = useState(() =>
    getPasswordResetTokenFromPath(window.location.pathname)
  );
  const [verificationToken, setVerificationToken] = useState(() =>
    getVerificationTokenFromPath(window.location.pathname)
  );
  const [verificationEmail, setVerificationEmail] = useState("");
  const [guestToken, setGuestToken] = useState(() =>
    getGuestTokenFromPath(window.location.pathname)
  );

  const openTripById = useCallback(async (tripId: number, authToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const trip = (await response.json()) as Trip;

      if (!response.ok || typeof trip.id !== "number") {
        setInviteToken(null);
        setSelectedTrip(null);
        window.history.pushState({}, "", "/");
        return;
      }

      setInviteToken(null);
      setSelectedTrip(trip);
      window.history.pushState({}, "", "/");
    } catch {
      setInviteToken(null);
      setSelectedTrip(null);
      window.history.pushState({}, "", "/");
    }
  }, []);

  const handleLogin = (nextToken: string, user: AuthUser) => {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(user));
    setCurrentUser(user);
    setToken(nextToken);

    const redirect = getSafeRedirect(window.location.search);

    if (!redirect) {
      return;
    }

    window.history.pushState({}, "", redirect);
    const nextInviteToken = getInviteTokenFromPath(window.location.pathname);
    const openTripId = getOpenTripId(window.location.search);
    setInviteToken(nextInviteToken);
    setSelectedTrip(null);

    if (!nextInviteToken && openTripId) {
      void openTripById(openTripId, nextToken);
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setSelectedTrip(null);
    setAppPage("trips");
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
          typeof user.role !== "string" ||
          typeof user.emailVerified !== "boolean"
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

  const handleGoToLogin = (redirectPath: string) => {
    const redirect = redirectPath.startsWith("/") && !redirectPath.startsWith("//") ? redirectPath : "/";

    handleLogout();
    window.history.pushState({}, "", `/?redirect=${encodeURIComponent(redirect)}`);
    setInviteToken(null);
    setSelectedTrip(null);
    setAuthPage("login");
  };

  const handleOpenAcceptedTrip = (tripId: number) => {
    if (!token) {
      handleGoToLogin(`/?openTrip=${tripId}`);
      return;
    }

    void openTripById(tripId, token);
  };

  const handleUserUpdated = (nextToken: string, user: AuthUser) => {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(user));
    setToken(nextToken);
    setCurrentUser(user);
  };

  const handleBackToLogin = () => {
    window.history.pushState({}, "", "/");
    setPasswordResetToken(null);
    setAuthPage("login");
  };

  const handlePasswordResetSuccess = () => {
    handleLogout();
    window.history.pushState({}, "", "/");
    setPasswordResetToken(null);
    setAuthPage("login");
    setAuthNotice("Password reset successfully. You can now log in.");
  };

  const handleVerificationBackToLogin = useCallback((notice = "") => {
    handleLogout();
    window.history.pushState({}, "", "/");
    setVerificationToken(null);
    setAuthPage("login");
    setAuthNotice(notice);
  }, [handleLogout]);

  return (
    <main className="app">
      {isAuthBootstrapping ? (
        <p className="loading-state">Restoring your session...</p>
      ) : guestToken !== null ? (
        <GuestTripPage
          guestToken={guestToken}
          onExit={() => {
            window.history.pushState({}, "", "/");
            setGuestToken(null);
          }}
        />
      ) : verificationToken !== null ? (
        <div className="auth-layout">
          <div className="brand-panel">
            <p className="eyebrow">TripBuddy</p>
            <h1>Confirm your address.</h1>
            <p>Finish setting up your account securely.</p>
          </div>
          <div className="auth-column">
            <VerifyEmailPage
              verificationToken={verificationToken}
              onBackToLogin={handleVerificationBackToLogin}
            />
          </div>
        </div>
      ) : passwordResetToken !== null ? (
        <ResetPasswordPage
          resetToken={passwordResetToken}
          onBackToLogin={handleBackToLogin}
          onResetSuccess={handlePasswordResetSuccess}
        />
      ) : inviteToken ? (
        <AcceptInvitePage
          token={token}
          inviteToken={inviteToken}
          onBackToTrips={handleBackToTrips}
          onGoToLogin={handleGoToLogin}
          onOpenTrip={handleOpenAcceptedTrip}
          onOpenGuestTrip={(newGuestToken) => {
            window.history.pushState(
              {},
              "",
              `/guest/${encodeURIComponent(newGuestToken)}`
            );
            setInviteToken(null);
            setGuestToken(newGuestToken);
          }}
        />
      ) : token ? (
        appPage === "profile" && currentUser ? (
          <ProfilePage
            token={token}
            currentUser={currentUser}
            onBack={() => setAppPage("trips")}
            onUnauthorized={handleLogout}
            onUserUpdated={handleUserUpdated}
          />
        ) : selectedTrip ? (
          <TripDetailsPage
            token={token}
            trip={selectedTrip}
            tripRole={getUserTripRole(selectedTrip, currentUser?.id) ?? "guest"}
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
            onOpenProfile={() => setAppPage("profile")}
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
            <RegisterPage
              onBackToLogin={() => setAuthPage("login")}
              onRegistrationSuccess={(message) => {
                setAuthNotice(message);
                setAuthPage("login");
              }}
            />
          </div>
        </div>
      ) : authPage === "forgot-password" ? (
        <div className="auth-layout">
          <div className="brand-panel">
            <p className="eyebrow">TripBuddy</p>
            <h1>Find your way back.</h1>
            <p>Request a secure, time-limited link to choose a new password.</p>
          </div>
          <div className="auth-column">
            <ForgotPasswordPage onBackToLogin={() => setAuthPage("login")} />
          </div>
        </div>
      ) : authPage === "resend-verification" ? (
        <div className="auth-layout">
          <div className="brand-panel">
            <p className="eyebrow">TripBuddy</p>
            <h1>One last step.</h1>
            <p>Verify your email before opening your trips.</p>
          </div>
          <div className="auth-column">
            <ResendVerificationPage
              email={verificationEmail}
              onBackToLogin={() => setAuthPage("login")}
            />
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
            <LoginPage
              onLogin={handleLogin}
              onForgotPassword={() => {
                setAuthNotice("");
                setAuthPage("forgot-password");
              }}
              onVerificationRequired={(email) => {
                setVerificationEmail(email);
                setAuthPage("resend-verification");
              }}
              notice={authNotice}
            />
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
