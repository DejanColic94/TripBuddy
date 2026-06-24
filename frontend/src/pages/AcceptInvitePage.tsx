import { useEffect, useState } from "react";
import { acceptTripInvite } from "../api/invites";

type AcceptInvitePageProps = {
  token: string;
  inviteToken: string;
  onBackToTrips: () => void;
  onUnauthorized: () => void;
};

function getInviteErrorMessage(status: number, fallback?: string) {
  if (status === 404) {
    return "Invite not found";
  }

  if (status === 409) {
    return "Invite already accepted";
  }

  return fallback || "Failed to accept invite";
}

function AcceptInvitePage({
  token,
  inviteToken,
  onBackToTrips,
  onUnauthorized,
}: AcceptInvitePageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function acceptInvite() {
      setIsLoading(true);
      setMessage("");
      setError("");

      try {
        const { response, data } = await acceptTripInvite(inviteToken, token);

        if (!isMounted) {
          return;
        }

        if (response.status === 401) {
          onUnauthorized();
          return;
        }

        if (!response.ok || !("id" in data)) {
          setError(getInviteErrorMessage(response.status, "error" in data ? data.error : undefined));
          return;
        }

        setMessage("Invite accepted. This trip is now available in your dashboard.");
      } catch {
        if (isMounted) {
          setError("Failed to accept invite");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void acceptInvite();

    return () => {
      isMounted = false;
    };
  }, [inviteToken, onUnauthorized, token]);

  return (
    <section className="page invite-accept-page">
      <div className="auth-layout">
        <div className="brand-panel">
          <p className="eyebrow">TripBuddy invite</p>
          <h1>Join the trip.</h1>
          <p>Accept your invitation and the shared plan will appear with your trips.</p>
        </div>

        <section className="auth-card invite-accept-card">
          <h2>Trip invite</h2>
          {isLoading ? <p className="loading-state">Accepting invite...</p> : null}
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="secondary-button" type="button" onClick={onBackToTrips}>
            Back to trips
          </button>
        </section>
      </div>
    </section>
  );
}

export default AcceptInvitePage;
