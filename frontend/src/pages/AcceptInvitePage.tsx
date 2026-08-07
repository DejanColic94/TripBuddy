import { type FormEvent, useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  ApiRequestError,
  acceptTripInvite,
  continueAsGuest,
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
  onOpenGuestTrip: (guestToken: string) => void;
};

type InviteStatus =
  | { kind: "loading" }
  | { kind: "ready"; invite: TripInvitePreview }
  | { kind: "success"; invite: AcceptTripInviteResponse }
  | { kind: "error"; status: number; message: string };

function getInviteErrorTitle(status: number, message: string, t: TFunction) {
  if (status === 401) return t("invite.errors.loginRequired");
  if (status === 403 && message === "Invite belongs to a different email") {
    return t("invite.errors.wrongAccount");
  }
  if (status === 404) return t("invite.errors.notFound");
  if (status === 409) return t("invite.errors.alreadyAccepted");
  if (status === 410) return t("invite.errors.expired");
  if (status === 502) return t("invite.errors.unavailable");
  return t("invite.errors.unable");
}

function getInviteErrorMessage(status: number, message: string, t: TFunction) {
  if (status === 401) {
    return t("invite.errors.loginRequiredDetail");
  }
  if (status === 403 && message === "Invite belongs to a different email") {
    return t("invite.errors.wrongAccountDetail");
  }
  if (status === 404) return t("invite.errors.notFoundDetail");
  if (status === 409) return t("invite.errors.alreadyAcceptedDetail");
  if (status === 410) return t("invite.errors.expiredDetail");
  if (status === 502) return t("invite.errors.unavailableDetail");
  return message || t("invite.errors.genericDetail");
}

function AcceptInvitePage({
  token,
  inviteToken,
  onBackToTrips,
  onGoToLogin,
  onOpenTrip,
  onOpenGuestTrip,
}: AcceptInvitePageProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<InviteStatus>({ kind: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestName, setGuestName] = useState("");
  const trimmedInviteToken = inviteToken.trim();
  const currentInvitePath = `/invite/${encodeURIComponent(trimmedInviteToken)}`;

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      if (!trimmedInviteToken) {
        setStatus({ kind: "error", status: 400, message: t("invite.errors.invalid") });
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
          setStatus({ kind: "error", status: 500, message: t("invite.errors.loadFailed") });
        }
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [t, trimmedInviteToken]);

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
        setStatus({ kind: "error", status: 500, message: t("invite.errors.acceptFailed") });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();

    if (!normalizedName) {
      setFormError(t("validation.nameRequired"));
      return;
    }
    if (normalizedName.length > 255) {
      setFormError(t("validation.nameTooLong"));
      return;
    }
    if (password.length < 8) {
      setFormError(t("validation.passwordMin"));
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setFormError(t("validation.passwordMaxBytes"));
      return;
    }
    if (password !== confirmPassword) {
      setFormError(t("validation.passwordsMismatch"));
      return;
    }

    await accept({ name: normalizedName, password });
  };

  const handleGuestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = guestName.trim();
    if (!normalizedName) {
      setFormError(t("invite.displayNameRequired"));
      return;
    }
    setFormError("");
    setIsSubmitting(true);
    try {
      const guestAccess = await continueAsGuest(trimmedInviteToken, normalizedName);
      onOpenGuestTrip(guestAccess.guestToken);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setStatus({ kind: "error", status: error.status, message: error.error });
      } else {
        setStatus({ kind: "error", status: 500, message: t("invite.errors.guestFailed") });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page invite-accept-page">
      <div className="auth-layout">
        <div className="brand-panel">
          <p className="eyebrow">{t("invite.eyebrow")}</p>
          <h1>{t("invite.title")}</h1>
          <p>{t("invite.subtitle")}</p>
        </div>

        <section className="auth-card invite-accept-card">
          <h2>{t("invite.invitation")}</h2>

          {status.kind === "loading" ? (
            <p className="loading-state">{t("invite.loading")}</p>
          ) : null}

          {status.kind === "ready" ? (
            <>
              <div className="invite-summary">
                <strong>{status.invite.tripName}</strong>
                <p>{t("invite.invitedBy", { name: status.invite.inviterName })}</p>
                <p>{t("invite.invitedEmail", { email: status.invite.email })}</p>
                <p>{t("invite.tripRole", { role: t(`roles.${status.invite.role}`) })}</p>
              </div>

              {token ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void accept()}
                >
                  {isSubmitting ? t("invite.accepting") : t("invite.accept")}
                </button>
              ) : status.invite.accountExists ? (
                <>
                  <p>{t("invite.accountExists")}</p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => onGoToLogin(currentInvitePath)}
                  >
                    {t("invite.loginToAccept")}
                  </button>
                </>
              ) : (
                <form className="form-stack" onSubmit={handleCreateAccount}>
                  <p>{t("invite.createAccountDescription")}</p>
                  <label>
                    {t("common.name")}
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      maxLength={255}
                      required
                    />
                  </label>
                  <label>
                    {t("common.email")}
                    <input value={status.invite.email} readOnly />
                  </label>
                  <label>
                    {t("common.password")}
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
                    {t("auth.confirmPassword")}
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
                    {isSubmitting ? t("invite.creatingAccount") : t("invite.createAndJoin")}
                  </button>
                </form>
              )}
              {!token && !status.invite.accountExists ? (
                <form className="form-stack" onSubmit={handleGuestSubmit}>
                  <p>{t("invite.guestDescription")}</p>
                  <label>
                    {t("invite.guestDisplayName")}
                    <input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      maxLength={255}
                      required
                    />
                  </label>
                  {formError ? <p className="error">{formError}</p> : null}
                  <button className="secondary-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t("invite.openingTrip") : t("invite.continueAsGuest")}
                  </button>
                </form>
              ) : null}
            </>
          ) : null}

          {status.kind === "success" ? (
            <>
              <div className="success">
                <strong>
                  {status.invite.accountCreated
                    ? t("invite.accountCreatedAndAccepted")
                    : t("invite.accepted")}
                </strong>
                <p>{t("invite.connected")}</p>
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
                {status.invite.accountCreated ? t("invite.loginAndOpen") : t("invite.openAccepted")}
              </button>
            </>
          ) : null}

          {status.kind === "error" ? (
            <>
              <div className="error">
                <strong>{getInviteErrorTitle(status.status, status.message, t)}</strong>
                <p>{getInviteErrorMessage(status.status, status.message, t)}</p>
              </div>
              {status.status === 401 || status.status === 403 ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onGoToLogin(currentInvitePath)}
                >
                  {t("invite.loginWithInvitedAccount")}
                </button>
              ) : (
                <button className="secondary-button" type="button" onClick={onBackToTrips}>
                  {t("common.backToHome")}
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
