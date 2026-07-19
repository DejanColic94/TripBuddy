import { useEffect, useMemo, useState } from "react";
import {
  ApiRequestError,
  acceptTripInvite,
  type AcceptTripInviteResponse,
} from "../api/invites";

type AcceptInvitePageProps = {
  token: string | null;
  inviteToken: string;
  onBackToTrips: () => void;
  onGoToLogin: (redirectPath: string) => void;
  onOpenTrip: (tripId: number) => void;
};

type InviteStatus =
  | { kind: "loading" }
  | { kind: "success"; invite: AcceptTripInviteResponse }
  | { kind: "error"; status: number; message: string };

const acceptRequestCache = new Map<string, Promise<AcceptTripInviteResponse>>();

function getAcceptRequest(
  key: string,
  inviteToken: string,
  token: string | null
) {
  const cachedRequest = acceptRequestCache.get(key);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = acceptTripInvite(inviteToken, token);
  acceptRequestCache.set(key, request);

  return request;
}

function getInviteErrorTitle(status: number, message: string) {
  if (status === 401) {
    return "Login required for invited email";
  }

  if (status === 403 && message === "Invite belongs to a different email") {
    return "Signed into a different account";
  }

  if (status === 403) {
    return "Account verification needed";
  }

  if (status === 404) {
    return "Invitation not found";
  }

  if (status === 409) {
    return "Invitation already accepted";
  }

  if (status === 502) {
    return "Invitation service is temporarily unavailable";
  }

  return "Unable to accept invitation";
}

function getInviteErrorMessage(status: number, message: string, isLoggedIn: boolean) {
  if (status === 401) {
    return "An account already exists for this email. Log in with that account to accept the invitation.";
  }

  if (status === 403 && message === "Invite belongs to a different email") {
    return "This invitation was sent to a different email address. Use the invited account to accept it.";
  }

  if (status === 403) {
    return "We could not confirm the email address for your signed-in account. Please log in again.";
  }

  if (status === 404) {
    return "The link may be invalid or no longer available.";
  }

  if (status === 409) {
    return isLoggedIn
      ? "This invitation has already been accepted. You can continue to your dashboard."
      : "This invitation has already been accepted. Log in to view your trips.";
  }

  if (status === 502) {
    return "We could not finish setting up the invited account right now. Please try again.";
  }

  return "Something went wrong while accepting this invitation. Please try again.";
}

function AcceptInvitePage({
  token,
  inviteToken,
  onBackToTrips,
  onGoToLogin,
  onOpenTrip,
}: AcceptInvitePageProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState<InviteStatus>({ kind: "loading" });
  const isLoggedIn = Boolean(token);
  const trimmedInviteToken = inviteToken.trim();
  const currentInvitePath = `/invite/${encodeURIComponent(trimmedInviteToken)}`;
  const requestKey = useMemo(
    () => `${trimmedInviteToken}:${token ?? "anonymous"}:${retryCount}`,
    [retryCount, token, trimmedInviteToken]
  );

  useEffect(() => {
    if (!trimmedInviteToken) {
      setStatus({ kind: "error", status: 400, message: "Invalid invitation link" });
      return;
    }

    let isMounted = true;

    async function acceptInvite() {
      setStatus({ kind: "loading" });

      try {
        const invite = await getAcceptRequest(requestKey, trimmedInviteToken, token);

        if (!isMounted) {
          return;
        }

        setStatus({ kind: "success", invite });
      } catch (error) {
        if (isMounted) {
          if (error instanceof ApiRequestError) {
            setStatus({ kind: "error", status: error.status, message: error.error });
          } else {
            setStatus({
              kind: "error",
              status: 500,
              message: "Failed to accept trip invite",
            });
          }
        }
      }
    }

    void acceptInvite();

    return () => {
      isMounted = false;
    };
  }, [requestKey, token, trimmedInviteToken]);

  const handleRetry = () => {
    setRetryCount((current) => current + 1);
  };

  const handleLoginForInvite = () => {
    onGoToLogin(currentInvitePath);
  };

  const handleLoginForTrip = (tripId: number) => {
    onGoToLogin(`/?openTrip=${tripId}`);
  };

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
          {status.kind === "loading" ? (
            <p className="loading-state">Accepting your TripBuddy invitation...</p>
          ) : null}

          {status.kind === "success" && !status.invite.accountCreated ? (
            <>
              <div className="success">
                <strong>Invitation accepted</strong>
                <p>This trip was added to your account.</p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => onOpenTrip(status.invite.tripId)}
              >
                Open accepted trip
              </button>
            </>
          ) : null}

          {status.kind === "success" && status.invite.accountCreated ? (
            <>
              <div className="success">
                <strong>Your TripBuddy account has been created</strong>
                <p>
                  Temporary login credentials were sent to {status.invite.email}. Use them to log in,
                  then change the temporary password after login.
                </p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => handleLoginForTrip(status.invite.tripId)}
              >
                Go to login
              </button>
            </>
          ) : null}

          {status.kind === "error" ? (
            <>
              <div className="error">
                <strong>{getInviteErrorTitle(status.status, status.message)}</strong>
                <p>{getInviteErrorMessage(status.status, status.message, isLoggedIn)}</p>
              </div>

              {status.status === 401 ? (
                <button className="primary-button" type="button" onClick={handleLoginForInvite}>
                  Log in to accept invitation
                </button>
              ) : null}

              {status.status === 403 ? (
                <button className="secondary-button" type="button" onClick={onBackToTrips}>
                  Back to dashboard
                </button>
              ) : null}

              {status.status === 404 ? (
                <button className="secondary-button" type="button" onClick={onBackToTrips}>
                  Back to home
                </button>
              ) : null}

              {status.status === 409 ? (
                isLoggedIn ? (
                  <button className="secondary-button" type="button" onClick={onBackToTrips}>
                    Open dashboard
                  </button>
                ) : (
                  <button className="primary-button" type="button" onClick={handleLoginForInvite}>
                    Go to login
                  </button>
                )
              ) : null}

              {status.status === 500 || status.status === 502 ? (
                <button className="primary-button" type="button" onClick={handleRetry}>
                  Retry
                </button>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default AcceptInvitePage;
