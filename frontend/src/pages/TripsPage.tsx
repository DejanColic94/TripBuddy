import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";

type TripsPageProps = {
  token: string;
  onUnauthorized: () => void;
};

type Trip = {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdBy: number;
};

type CreateTripResponse = Trip | { error?: string };

const formatTripDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

function TripsPage({ token, onUnauthorized }: TripsPageProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
          startDate: startDate || undefined,
          endDate: endDate || undefined,
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
        </div>
        <button className="secondary-button" type="button" onClick={onUnauthorized}>
          Logout
        </button>
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

            <div className="date-inputs">
              <label>
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>

              <label>
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
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

          {isLoading ? <p className="empty-state">Loading trips...</p> : null}

          {!isLoading && trips.length === 0 ? (
            <p className="empty-state">No trips yet. Add your first destination to get started.</p>
          ) : null}

          {!isLoading && trips.length > 0 ? (
            <ul className="trip-list">
              {trips.map((trip) => (
                <li className="trip-card" key={trip.id}>
                  <div>
                    <strong>{trip.name}</strong>
                    <p>{trip.description || "No description"}</p>
                  </div>
                  <div className="trip-dates">
                    <span>Start: {formatTripDate(trip.startDate)}</span>
                    <span>End: {formatTripDate(trip.endDate)}</span>
                  </div>
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