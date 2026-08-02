import { useCallback, useEffect, useState, type FormEvent } from "react";
import LocationAutocomplete from "../components/LocationAutocomplete";
import { API_BASE_URL } from "../config/api";
import type { AuthUser } from "../types/auth";
import type { LocationSearchResult } from "../types/location";
import { formatTripDate, type Trip } from "../types/trip";

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
        setError("Failed to load trips");
        return;
      }

      const data = (await response.json()) as Trip[];
      setTrips(data);
    } catch {
      setError("Failed to load trips");
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized, token]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!selectedDestination) {
      setError("Choose a destination from the search results");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start date and end date are required");
      return;
    }
    if (startDate > endDate) {
      setError("Start date must not be after end date");
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
        setError(("error" in data && data.error) || "Failed to create trip");
        return;
      }

      setTrips((currentTrips) => [data, ...currentTrips]);
      setName("");
      setDescription("");
      setDestinationQuery("");
      setSelectedDestination(null);
      setStartDate("");
      setEndDate("");
      setSuccessMessage("Trip created");
    } catch {
      setError("Failed to create trip");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page trips-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">TripBuddy</p>
          <h1>Your trips</h1>
          <p className="page-subtitle">Shape the details now, enjoy the journey later.</p>
          {currentUser ? (
            <p className="current-user">Signed in as <strong>{currentUser.name}</strong></p>
          ) : null}
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={onOpenProfile}>
            My Profile
          </button>
          <button className="secondary-button" type="button" onClick={onUnauthorized}>
            Logout
          </button>
        </div>
      </div>

      <div className="trips-layout">
        <section className="panel create-trip-card">
          <h2>Create a trip</h2>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>

            <label>
              Description
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
                Start date
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>

              <label>
                End date
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
              {isSubmitting ? "Creating..." : "Create trip"}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}
          {successMessage ? <p className="success">{successMessage}</p> : null}
        </section>

        <section className="trip-list-section">
          <div className="section-heading">
            <h2>Saved trips</h2>
            <span>{trips.length} total</span>
          </div>

          {isLoading ? <p className="loading-state">Gathering your trips...</p> : null}

          {!isLoading && trips.length === 0 ? (
            <p className="empty-state">
              No trips saved yet. Create your first plan and it will appear here with dates,
              notes, and the little details worth remembering.
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
                    <p>{trip.description || "No description"}</p>
                  </div>
                  <div className="trip-dates">
                    <span>Start: {formatTripDate(trip.startDate)}</span>
                    <span>End: {formatTripDate(trip.endDate)}</span>
                  </div>
                  {trip.participants && trip.participants.length > 0 ? (
                    <div className="trip-card-participants" aria-label={`${trip.name} participants`}>
                      <p>Participants</p>
                      <div>
                        {trip.participants.map((participant) => (
                          <span key={`${trip.id}-${participant.userId}`}>
                            {participant.name || `User #${participant.userId}`} · {participant.role}
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
