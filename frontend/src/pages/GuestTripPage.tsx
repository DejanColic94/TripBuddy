import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

type GuestTrip = {
  guest: { displayName: string; expiresAt: string };
  trip: {
    name: string;
    description: string | null;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  itinerary: Array<{ id: number; title: string; description: string | null; scheduledDate: string | null }>;
  expenses: Array<{ id: number; title: string; amount: number; currency: string; category: string | null }>;
};

function GuestTripPage({ guestToken, onExit }: { guestToken: string; onExit: () => void }) {
  const [data, setData] = useState<GuestTrip | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/trips/guests/${encodeURIComponent(guestToken)}/trip`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Failed to load guest trip");
        if (active) setData(body as GuestTrip);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Failed to load guest trip");
      });
    return () => {
      active = false;
    };
  }, [guestToken]);

  if (error) return <section className="page"><p className="error">{error}</p><button onClick={onExit}>Back to home</button></section>;
  if (!data) return <p className="loading-state">Loading shared trip...</p>;

  return (
    <section className="page">
      <div className="page-header">
        <div><p className="eyebrow">Read-only guest access</p><h1>{data.trip.name}</h1><p>{data.trip.destination}</p></div>
        <button className="secondary-button" onClick={onExit}>Back to home</button>
      </div>
      <section className="panel"><h2>Trip details</h2><p>{data.trip.description || "No description"}</p><p>{data.trip.startDate || "Unscheduled"} – {data.trip.endDate || "Unscheduled"}</p></section>
      <section className="panel"><h2>Itinerary</h2>{data.itinerary.length ? data.itinerary.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.scheduledDate || "No date"} · {item.description || "No description"}</p></article>) : <p>No itinerary items yet.</p>}</section>
      <section className="panel"><h2>Expenses</h2>{data.expenses.length ? data.expenses.map((expense) => <article key={expense.id}><strong>{expense.title}</strong><p>{expense.amount} {expense.currency}{expense.category ? ` · ${expense.category}` : ""}</p></article>) : <p>No expenses yet.</p>}</section>
    </section>
  );
}

export default GuestTripPage;
