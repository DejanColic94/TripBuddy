import { type FormEvent, useEffect, useState } from "react";
import {
  ApiRequestError,
  acceptTripInvite,
  fetchTripInvitePreview,
  type AcceptTripInviteResponse,
  type TripInvitePreview,
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
  | { kind: "ready"; invite: TripInvitePreview }
  | { kind: "success"; invite: AcceptTripInviteResponse }
  | { kind: "error"; status: number; message: string };

function getInviteErrorTitle(status: number, message: string) {
  if (status === 401) return "Login required for invited email";
  if (status === 403 && message === "Invite belongs to a different email") {
    return "Signed into a different account";
  }
  if (status === 404) return "Invitation not found";
  if (status === 409) return "Invitation already accepted";
  if (status === 410) return "Invitation expired";
  if (status === 502) return "Invitation service is temporarily unavailable";
  return "Unable to accept invitation";
}

function getInviteErrorMessage(status: number, message: string) {
  if (status === 401) {
    return "An account now exists for this email. Log in with that account to accept the invitation.";
  }
  if (status === 403 && message === "Invite belongs to a different email") {
    return "This invitation was sent to a different email address. Log in with the invited account.";
  }
  if (status === 404) return "The link is invalid or no longer available.";
  if (status === 409) return "This invitation has already been used.";
  if (status === 410) return "Ask the trip owner to send you a new invitation.";
  if (status === 502) return "Please try again in a moment.";
  return message || "Something went wrong while processing this invitation.";
}

function AcceptInvitePage({
  token,
  inviteToken,
  onBackToTrips,
  onGoToLogin,
  onOpenTrip,
}: AcceptInvitePageProps) {
  const [status, setStatus] = useState<InviteStatus>({ kind: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmedInviteToken = inviteToken.trim();
  const currentInvitePath = `/invite/${encodeURIComponent(trimmedInviteToken)}`;

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      if (!trimmedInviteToken) {
        setStatus({ kind: "error", status: 400, message: "Invalid invitation link" });
        return;
      }

      setStatus({ kind: "loading" });
      try {
        const invite = await fetchTripInvitePreview(trimmedInviteToken);
        if (active) setStatus({ kind: "ready", invite });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiRequestError) {
          setStatus({ kind: "error", status: error.status, message: error.error });
        } else {
          setStatus({ kind: "error", status: 500, message: "Failed to load invitation" });
        }
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [trimmedInviteToken]);

  const accept = async (account?: { name: string; password: string }) => {
    setFormError("");
    setIsSubmitting(true);
    try {
      const acceptedInvite = await acceptTripInvite(
        trimmedInviteToken,
        token,
        account
      );
      setStatus({ kind: "success", invite: acceptedInvite });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setStatus({ kind: "error", status: error.status, message: error.error });
      } else {
        setStatus({ kind: "error", status: 500, message: "Failed to accept invitation" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();

    if (!normalizedName) {
      setFormError("Name is required");
      return;
    }
    if (normalizedName.length > 255) {
      setFormError("Name must be 255 characters or fewer");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setFormError("Password must be 72 bytes or fewer");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    await accept({ name: normalizedName, password });
  };

  return (
    <section className="page invite-accept-page">
      <div className="auth-layout">
        <div className="brand-panel">
          <p className="eyebrow">TripBuddy invite</p>
          <h1>Join the trip.</h1>
          <p>Review the invitation, then choose how you want to continue.</p>
        </div>

        <section className="auth-card invite-accept-card">
          <h2>Trip invitation</h2>

          {status.kind === "loading" ? (
            <p className="loading-state">Loading your invitation...</p>
          ) : null}

          {status.kind === "ready" ? (
            <>
              <div className="invite-summary">
                <strong>{status.invite.tripName}</strong>
                <p>Invited email: {status.invite.email}</p>
                <p>Trip role: {status.invite.role}</p>
              </div>

              {token ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void accept()}
                >
                  {isSubmitting ? "Accepting..." : "Accept invitation"}
                </button>
              ) : status.invite.accountExists ? (
                <>
                  <p>An account already exists for this email.</p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => onGoToLogin(currentInvitePath)}
                  >
                    Log in to accept invitation
                  </button>
                </>
              ) : (
                <form className="form-stack" onSubmit={handleCreateAccount}>
                  <p>Create your account to join this trip.</p>
                  <label>
                    Name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      maxLength={255}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input value={status.invite.email} readOnly />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>
                  <label>
                    Confirm password
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>
                  {formError ? <p className="error">{formError}</p> : null}
                  <button className="primary-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating account..." : "Create account and join"}
                  </button>
                </form>
              )}
            </>
          ) : null}

          {status.kind === "success" ? (
            <>
              <div className="success">
                <strong>
                  {status.invite.accountCreated
                    ? "Account created and invitation accepted"
                    : "Invitation accepted"}
                </strong>
                <p>This trip is now connected to your account.</p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={
                  status.invite.accountCreated
                    ? () => onGoToLogin(`/?openTrip=${status.invite.tripId}`)
                    : () => onOpenTrip(status.invite.tripId)
                }
              >
                {status.invite.accountCreated ? "Log in and open trip" : "Open accepted trip"}
              </button>
            </>
          ) : null}

          {status.kind === "error" ? (
            <>
              <div className="error">
                <strong>{getInviteErrorTitle(status.status, status.message)}</strong>
                <p>{getInviteErrorMessage(status.status, status.message)}</p>
              </div>
              {status.status === 401 || status.status === 403 ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onGoToLogin(currentInvitePath)}
                >
                  Log in with invited account
                </button>
              ) : (
                <button className="secondary-button" type="button" onClick={onBackToTrips}>
                  Back to home
                </button>
              )}
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default AcceptInvitePage;
