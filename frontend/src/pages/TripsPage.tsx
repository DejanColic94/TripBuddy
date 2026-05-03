import { useCallback, useEffect, useState, type FormEvent } from "react";

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
      const response = await fetch("http://localhost:4000/trips", {
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
      const response = await fetch("http://localhost:4000/trips", {
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
    <section className="page">
      <div className="page-header">
        <h1>Trips</h1>
        <button type="button" onClick={onUnauthorized}>
          Logout
        </button>
      </div>

      <form onSubmit={handleSubmit}>
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

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create trip"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {successMessage ? <p className="success">{successMessage}</p> : null}

      <div>
        <h2>Your trips</h2>

        {isLoading ? <p>Loading trips...</p> : null}

        {!isLoading && trips.length === 0 ? <p>No trips yet.</p> : null}

        {!isLoading && trips.length > 0 ? (
          <ul>
            {trips.map((trip) => (
              <li key={trip.id}>
                <strong>{trip.name}</strong>
                <div>{trip.description || "No description"}</div>
                <div>Start: {trip.startDate || "-"}</div>
                <div>End: {trip.endDate || "-"}</div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export default TripsPage;
