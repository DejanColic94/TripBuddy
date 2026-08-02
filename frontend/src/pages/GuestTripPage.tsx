import { useEffect, useState } from "react";
import WeatherForecast from "../components/WeatherForecast";
import { API_BASE_URL } from "../config/api";
import { useExpenseConversion } from "../hooks/useExpenseConversion";
import { formatTripDate } from "../types/trip";

type GuestExpense = {
  id: number;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
};

type GuestTrip = {
  guest: { displayName: string; expiresAt: string };
  trip: {
    name: string;
    description: string | null;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  itinerary: Array<{
    id: number;
    title: string;
    description: string | null;
    scheduledDate: string | null;
  }>;
  expenses: GuestExpense[];
};

const displayCurrencies = ["EUR", "USD", "GBP", "CHF", "RSD", "CAD", "AUD", "JPY"];
const emptyExpenses: GuestExpense[] = [];

function formatExpenseAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function getTripDuration(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function GuestTripPage({ guestToken, onExit }: { guestToken: string; onExit: () => void }) {
  const [data, setData] = useState<GuestTrip | null>(null);
  const [error, setError] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState("EUR");
  const expenses = data?.expenses ?? emptyExpenses;
  const {
    convertedTotal,
    rateDate,
    isLoading: isConversionLoading,
    error: conversionError,
    subtotals,
    currencies,
  } = useExpenseConversion(expenses, displayCurrency);

  useEffect(() => {
    let active = true;

    fetch(`${API_BASE_URL}/trips/guests/${encodeURIComponent(guestToken)}/trip`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Failed to load guest trip");
        }
        if (active) {
          setData(body as GuestTrip);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Failed to load guest trip");
        }
      });

    return () => {
      active = false;
    };
  }, [guestToken]);

  if (error) {
    return (
      <section className="page guest-trip-state-page">
        <section className="panel guest-trip-state-card">
          <p className="eyebrow">Guest access unavailable</p>
          <h1>Unable to open this trip</h1>
          <p className="error">{error}</p>
          <button className="secondary-button" type="button" onClick={onExit}>
            Back to home
          </button>
        </section>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="page guest-trip-state-page">
        <section className="panel guest-trip-state-card">
          <p className="eyebrow">TripBuddy guest access</p>
          <h1>Opening your shared trip...</h1>
          <p className="loading-state">Gathering the itinerary and expenses.</p>
        </section>
      </section>
    );
  }

  const duration = getTripDuration(data.trip.startDate, data.trip.endDate);
  const singleExpenseCurrency = currencies.length === 1 ? currencies[0] : null;
  const displayedTotal =
    convertedTotal !== null
      ? formatExpenseAmount(convertedTotal, displayCurrency)
      : singleExpenseCurrency
        ? formatExpenseAmount(subtotals[singleExpenseCurrency], singleExpenseCurrency)
        : "Mixed currencies";

  return (
    <section className="page trip-details-page guest-trip-page">
      <div className="details-hero">
        <div>
          <p className="eyebrow">Read-only guest access</p>
          <h1>{data.trip.name}</h1>
          <p className="trip-description">
            {data.trip.description || "No description added yet."}
          </p>
          <div className="guest-access-badges">
            <span className="trip-role-badge trip-role-guest">Guest access</span>
            <span className="guest-name-badge">Viewing as {data.guest.displayName}</span>
          </div>
        </div>
        <div className="details-actions">
          <button className="secondary-button" type="button" onClick={onExit}>
            Back to home
          </button>
        </div>
      </div>

      <WeatherForecast
        destination={data.trip.destination}
        startDate={data.trip.startDate}
        endDate={data.trip.endDate}
      />

      <div className="details-layout">
        <section className="panel trip-info-card">
          <p className="eyebrow">Overview</p>
          <h2>{data.trip.name}</h2>
          <p>{data.trip.description || "No description added yet."}</p>
          <p className="guest-access-note">
            You can review this trip, but only signed-in trip members can make changes.
          </p>
        </section>

        <section className="panel metadata-card">
          <h2>Trip metadata</h2>
          <dl className="metadata-list">
            <div>
              <dt>Destination</dt>
              <dd>{data.trip.destination || "-"}</dd>
            </div>
            <div>
              <dt>Start date</dt>
              <dd>{formatTripDate(data.trip.startDate)}</dd>
            </div>
            <div>
              <dt>End date</dt>
              <dd>{formatTripDate(data.trip.endDate)}</dd>
            </div>
            <div>
              <dt>Guest access expires</dt>
              <dd>{formatTripDate(data.guest.expiresAt)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="summary-section">
        <div className="section-heading">
          <h2>Trip summary</h2>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <p>Duration</p>
            <strong>{duration === null ? "Unscheduled" : `${duration} days`}</strong>
          </article>
          <article className="summary-card">
            <p>Itinerary Items</p>
            <strong>{data.itinerary.length}</strong>
          </article>
          <article className="summary-card">
            <p>Total Expenses</p>
            <strong>{isConversionLoading ? "Converting..." : displayedTotal}</strong>
          </article>
          <article className="summary-card">
            <p>Expense Count</p>
            <strong>{data.expenses.length}</strong>
          </article>
        </div>
      </section>

      <div className="itinerary-layout read-only-content-layout">
        <section className="itinerary-section">
          <div className="section-heading">
            <h2>Itinerary</h2>
            <span>{data.itinerary.length} total</span>
          </div>

          {data.itinerary.length === 0 ? (
            <p className="empty-state">No itinerary items yet.</p>
          ) : (
            <ul className="itinerary-list">
              {data.itinerary.map((item) => (
                <li className="itinerary-item" key={item.id}>
                  <div className="itinerary-date">{formatTripDate(item.scheduledDate)}</div>
                  <div className="itinerary-card">
                    <strong>{item.title}</strong>
                    <p>{item.description || "No description"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="expenses-layout read-only-content-layout">
        <section className="expenses-section">
          <div className="expense-total-card">
            <div className="expense-total-heading">
              <div>
                <p className="eyebrow">Estimated total</p>
                <strong>{isConversionLoading ? "Converting..." : displayedTotal}</strong>
              </div>
              <label className="conversion-currency">
                Display currency
                <select
                  value={displayCurrency}
                  onChange={(event) => setDisplayCurrency(event.target.value)}
                >
                  {displayCurrencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {currencies.length > 0 ? (
              <p className="expense-subtotals">
                Original totals:{" "}
                {currencies
                  .map((currency) => formatExpenseAmount(subtotals[currency], currency))
                  .join(" · ")}
              </p>
            ) : null}
            {rateDate ? (
              <p className="conversion-note">
                Approximate reference rates for {rateDate} · Frankfurter
              </p>
            ) : null}
            {conversionError ? <p className="error conversion-error">{conversionError}</p> : null}
          </div>

          <div className="section-heading">
            <h2>Expenses</h2>
            <span>{data.expenses.length} total</span>
          </div>

          {data.expenses.length === 0 ? (
            <p className="empty-state">No expenses yet.</p>
          ) : (
            <ul className="expense-list">
              {data.expenses.map((expense) => (
                <li className="expense-card" key={expense.id}>
                  <div>
                    <strong>{expense.title}</strong>
                    <p>{expense.category || "Uncategorized"}</p>
                  </div>
                  <span>{formatExpenseAmount(expense.amount, expense.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

export default GuestTripPage;
