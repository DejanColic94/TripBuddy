import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";
import { formatTripDate, type Trip } from "../types/trip";

type TripDetailsPageProps = {
  token: string;
  trip: Trip;
  onBack: () => void;
  onUnauthorized: () => void;
};

type ItineraryItem = {
  id: number;
  tripId: number;
  title: string;
  description: string | null;
  scheduledDate: string | null;
  createdAt: string;
};

type CreateItineraryItemResponse = ItineraryItem | { error?: string };

function TripDetailsPage({ token, trip, onBack, onUnauthorized }: TripDetailsPageProps) {
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadItineraryItems = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/itinerary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as ItineraryItem[] | { error?: string };

      if (!response.ok || !Array.isArray(data)) {
        setError(("error" in data && data.error) || "Failed to load itinerary");
        return;
      }

      setItineraryItems(data);
    } catch {
      setError("Failed to load itinerary");
    } finally {
      setIsLoading(false);
    }
  }, [onUnauthorized, token, trip.id]);

  useEffect(() => {
    void loadItineraryItems();
  }, [loadItineraryItems]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/itinerary`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: description || undefined,
          scheduledDate: scheduledDate || undefined,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as CreateItineraryItemResponse;

      if (!response.ok || !("id" in data)) {
        setError(("error" in data && data.error) || "Failed to create itinerary item");
        return;
      }

      setItineraryItems((currentItems) => [...currentItems, data]);
      setTitle("");
      setDescription("");
      setScheduledDate("");
      setSuccessMessage("Itinerary item added");
    } catch {
      setError("Failed to create itinerary item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page trip-details-page">
      <div className="details-hero">
        <div>
          <p className="eyebrow">Trip details</p>
          <h1>{trip.name}</h1>
          <p>{trip.description || "No description added yet."}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to trips
        </button>
      </div>

      <div className="details-layout">
        <section className="panel trip-info-card">
          <p className="eyebrow">Overview</p>
          <h2>{trip.name}</h2>
          <p>{trip.description || "No description added yet."}</p>
        </section>

        <section className="panel metadata-card">
          <h2>Trip metadata</h2>
          <dl className="metadata-list">
            <div>
              <dt>Start date</dt>
              <dd>{formatTripDate(trip.startDate)}</dd>
            </div>
            <div>
              <dt>End date</dt>
              <dd>{formatTripDate(trip.endDate)}</dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>User #{trip.createdBy}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="itinerary-layout">
        <section className="panel itinerary-form-card">
          <h2>Add itinerary item</h2>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
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
              Scheduled date
              <input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
              />
            </label>

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add item"}
            </button>
          </form>

          {successMessage ? <p className="success">{successMessage}</p> : null}
        </section>

        <section className="itinerary-section">
          <div className="section-heading">
            <h2>Itinerary</h2>
            <span>{itineraryItems.length} total</span>
          </div>

          {error ? <p className="error">{error}</p> : null}
          {isLoading ? <p className="loading-state">Gathering itinerary...</p> : null}

          {!isLoading && itineraryItems.length === 0 ? (
            <p className="empty-state">
              No itinerary items yet. Add the first plan, booking, or place you do not want
              to miss.
            </p>
          ) : null}

          {!isLoading && itineraryItems.length > 0 ? (
            <ul className="itinerary-list">
              {itineraryItems.map((item) => (
                <li className="itinerary-item" key={item.id}>
                  <div className="itinerary-date">
                    {formatTripDate(item.scheduledDate)}
                  </div>
                  <div className="itinerary-card">
                    <strong>{item.title}</strong>
                    <p>{item.description || "No description"}</p>
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

export default TripDetailsPage;