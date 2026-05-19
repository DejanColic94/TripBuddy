import { formatTripDate, type Trip } from "../types/trip";

type TripDetailsPageProps = {
  trip: Trip;
  onBack: () => void;
};

function TripDetailsPage({ trip, onBack }: TripDetailsPageProps) {
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
    </section>
  );
}

export default TripDetailsPage;