import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import LocationAutocomplete from "../components/LocationAutocomplete";
import { API_BASE_URL } from "../config/api";
import type { AuthUser } from "../types/auth";
import type { LocationSearchResult } from "../types/location";
import { formatTripDate, type Trip } from "../types/trip";
import { getFormattingLocale } from "../i18n";

type TripsPageProps = {
  token: string;
  currentUser: AuthUser | null;
  onUnauthorized: () => void;
  onOpenProfile: () => void;
  onSelectTrip: (trip: Trip) => void;
};

type CreateTripResponse = Trip | { error?: string };

function TripsPage({
  token,
  currentUser,
  onUnauthorized,
  onOpenProfile,
  onSelectTrip,
}: TripsPageProps) {
  const { i18n, t } = useTranslation();
  const formattingLocale = getFormattingLocale(i18n.resolvedLanguage);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [selectedDestination, setSelectedDestination] =
    useState<LocationSearchResult | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const loadTrips = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      if (!response.ok) {
        setError(t("trips.loadFailed"));
        return;
      }

      const data = (await response.json()) as Trip[];
      setTrips(data);
    } catch {
      setError(t("trips.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized, t, token]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!selectedDestination) {
      setError(t("trips.chooseDestination"));
      return;
    }
    if (!startDate || !endDate) {
      setError(t("trips.dateRangeRequired"));
      return;
    }
    if (startDate > endDate) {
      setError(t("trips.startAfterEnd"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          destination: selectedDestination.displayName,
          destinationId: selectedDestination.id,
          destinationLatitude: selectedDestination.latitude,
          destinationLongitude: selectedDestination.longitude,
          destinationTimezone: selectedDestination.timezone,
          destinationCountryCode: selectedDestination.countryCode,
          startDate,
          endDate,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as CreateTripResponse;

      if (!response.ok || !("id" in data)) {
        setError(("error" in data && data.error) || t("trips.createFailed"));
        return;
      }

      setTrips((currentTrips) => [data, ...currentTrips]);
      setName("");
      setDescription("");
      setDestinationQuery("");
      setSelectedDestination(null);
      setStartDate("");
      setEndDate("");
      setSuccessMessage(t("trips.created"));
    } catch {
      setError(t("trips.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page trips-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t("trips.eyebrow")}</p>
          <h1>{t("trips.title")}</h1>
          <p className="page-subtitle">{t("trips.subtitle")}</p>
          {currentUser ? (
            <p className="current-user">{t("trips.signedInAsLabel")} <strong>{currentUser.name}</strong></p>
          ) : null}
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={onOpenProfile}>
            {t("trips.profile")}
          </button>
          <button className="secondary-button" type="button" onClick={onUnauthorized}>
            {t("trips.logout")}
          </button>
        </div>
      </div>

      <div className="trips-layout">
        <section className="panel create-trip-card">
          <h2>{t("trips.createTitle")}</h2>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              {t("common.name")}
              <input
                value={name}
                maxLength={255}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label>
              {t("trips.description")}
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </label>

            <LocationAutocomplete
              query={destinationQuery}
              selectedLocation={selectedDestination}
              onQueryChange={setDestinationQuery}
              onSelectionChange={setSelectedDestination}
              required
            />

            <div className="date-inputs">
              <label>
                {t("trips.startDate")}
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>

              <label>
                {t("trips.endDate")}
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </label>
            </div>

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("trips.creating") : t("trips.create")}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}
          {successMessage ? <p className="success">{successMessage}</p> : null}
        </section>

        <section className="trip-list-section">
          <div className="section-heading">
            <h2>{t("trips.savedTrips")}</h2>
            <span>{t("common.total", { count: trips.length })}</span>
          </div>

          {isLoading ? <p className="loading-state">{t("trips.loading")}</p> : null}

          {!isLoading && trips.length === 0 ? (
            <p className="empty-state">
              {t("trips.empty")}
            </p>
          ) : null}

          {!isLoading && trips.length > 0 ? (
            <ul className="trip-list">
              {trips.map((trip) => (
                <li
                  className="trip-card clickable-trip-card"
                  key={trip.id}
                  onClick={() => onSelectTrip(trip)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectTrip(trip);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <strong>{trip.name}</strong>
                    <p>{trip.description || t("trips.noDescriptionShort")}</p>
                  </div>
                  <div className="trip-dates">
                    <span>{t("trips.cardStart", { date: formatTripDate(trip.startDate, formattingLocale) })}</span>
                    <span>{t("trips.cardEnd", { date: formatTripDate(trip.endDate, formattingLocale) })}</span>
                  </div>
                  {trip.participants && trip.participants.length > 0 ? (
                    <div className="trip-card-participants" aria-label={t("trips.participantCount", { count: trip.participants.length })}>
                      <p>{t("trips.participants")}</p>
                      <div>
                        {trip.participants.map((participant) => (
                          <span key={`${trip.id}-${participant.userId}`}>
                            {participant.name || t("common.userFallback", { id: participant.userId })} · {t(`roles.${participant.role}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default TripsPage;
