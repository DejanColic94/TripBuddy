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

type Expense = {
  id: number;
  tripId: number;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  createdAt: string;
};

type CreateExpenseResponse = Expense | { error?: string };

type TripSummary = {
  itineraryCount: number;
  expenseCount: number;
  totalExpenses: number;
  tripDurationDays: number;
};

type TripParticipant = {
  id: number;
  tripId: number;
  userId: number;
  role: string;
  createdAt: string;
};

type CreateTripParticipantResponse = TripParticipant | { error?: string };

const formatExpenseAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

function TripDetailsPage({ token, trip, onBack, onUnauthorized }: TripDetailsPageProps) {
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [participantUserId, setParticipantUserId] = useState("");
  const [participantRole, setParticipantRole] = useState("viewer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState("EUR");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(true);
  const [isParticipantSubmitting, setIsParticipantSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpensesLoading, setIsExpensesLoading] = useState(true);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [error, setError] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [participantSuccessMessage, setParticipantSuccessMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [expenseSuccessMessage, setExpenseSuccessMessage] = useState("");

  const totalExpenseAmount = expenses.reduce((total, expense) => total + expense.amount, 0);
  const totalExpenseCurrency = expenses[0]?.currency ?? expenseCurrency;

  const loadSummary = useCallback(async () => {
    setSummaryError("");
    setIsSummaryLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as TripSummary | { error?: string };

      if (!response.ok || !("itineraryCount" in data)) {
        setSummaryError(("error" in data && data.error) || "Failed to load trip summary");
        return;
      }

      setSummary(data);
    } catch {
      setSummaryError("Failed to load trip summary");
    } finally {
      setIsSummaryLoading(false);
    }
  }, [onUnauthorized, token, trip.id]);

  const loadParticipants = useCallback(async () => {
    setParticipantError("");
    setIsParticipantsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/participants`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setParticipantError("Unauthorized");
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as TripParticipant[] | { error?: string };

      if (!response.ok || !Array.isArray(data)) {
        setParticipantError(("error" in data && data.error) || "Failed to load participants");
        return;
      }

      setParticipants(data);
    } catch {
      setParticipantError("Failed to load participants");
    } finally {
      setIsParticipantsLoading(false);
    }
  }, [onUnauthorized, token, trip.id]);

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

  const loadExpenses = useCallback(async () => {
    setExpenseError("");
    setIsExpensesLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/expenses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as Expense[] | { error?: string };

      if (!response.ok || !Array.isArray(data)) {
        setExpenseError(("error" in data && data.error) || "Failed to load expenses");
        return;
      }

      setExpenses(data);
    } catch {
      setExpenseError("Failed to load expenses");
    } finally {
      setIsExpensesLoading(false);
    }
  }, [onUnauthorized, token, trip.id]);

  useEffect(() => {
    void loadSummary();
    void loadParticipants();
    void loadItineraryItems();
    void loadExpenses();
  }, [loadExpenses, loadItineraryItems, loadParticipants, loadSummary]);

  const handleParticipantSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParticipantError("");
    setParticipantSuccessMessage("");
    setIsParticipantSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/participants`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: Number(participantUserId),
          role: participantRole,
        }),
      });

      if (response.status === 401) {
        setParticipantError("Unauthorized");
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as CreateTripParticipantResponse;

      if (!response.ok || !("id" in data)) {
        if (response.status === 409) {
          setParticipantError("Participant already exists");
        } else if (response.status === 404) {
          setParticipantError("Only the trip owner can add participants");
        } else {
          setParticipantError(("error" in data && data.error) || "Failed to add participant");
        }
        return;
      }

      setParticipantUserId("");
      setParticipantRole("viewer");
      setParticipantSuccessMessage("Participant added");
      await loadParticipants();
    } catch {
      setParticipantError("Failed to add participant");
    } finally {
      setIsParticipantSubmitting(false);
    }
  };

  const handleItinerarySubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              itineraryCount: currentSummary.itineraryCount + 1,
            }
          : currentSummary
      );
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

  const handleExpenseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExpenseError("");
    setExpenseSuccessMessage("");
    setIsExpenseSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/expenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: expenseTitle,
          amount: Number(expenseAmount),
          currency: expenseCurrency,
          category: expenseCategory || undefined,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      const data = (await response.json()) as CreateExpenseResponse;

      if (!response.ok || !("id" in data)) {
        setExpenseError(("error" in data && data.error) || "Failed to create expense");
        return;
      }

      setExpenses((currentExpenses) => [data, ...currentExpenses]);
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              expenseCount: currentSummary.expenseCount + 1,
              totalExpenses: currentSummary.totalExpenses + data.amount,
            }
          : currentSummary
      );
      setExpenseTitle("");
      setExpenseAmount("");
      setExpenseCurrency(data.currency);
      setExpenseCategory("");
      setExpenseSuccessMessage("Expense added");
    } catch {
      setExpenseError("Failed to create expense");
    } finally {
      setIsExpenseSubmitting(false);
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

      <section className="summary-section">
        <div className="section-heading">
          <h2>Trip summary</h2>
        </div>

        {summaryError ? <p className="error">{summaryError}</p> : null}
        {isSummaryLoading ? <p className="loading-state">Gathering trip summary...</p> : null}

        {!isSummaryLoading && summary ? (
          <div className="summary-grid">
            <article className="summary-card">
              <p>Duration</p>
              <strong>{summary.tripDurationDays} days</strong>
            </article>
            <article className="summary-card">
              <p>Itinerary Items</p>
              <strong>{summary.itineraryCount}</strong>
            </article>
            <article className="summary-card">
              <p>Total Expenses</p>
              <strong>{formatExpenseAmount(summary.totalExpenses, totalExpenseCurrency)}</strong>
            </article>
            <article className="summary-card">
              <p>Expense Count</p>
              <strong>{summary.expenseCount}</strong>
            </article>
          </div>
        ) : null}
      </section>

      <div className="participants-layout">
        <section className="panel participant-form-card">
          <h2>Add participant</h2>

          <form className="form-stack" onSubmit={handleParticipantSubmit}>
            <label>
              User ID
              <input
                type="number"
                min="1"
                value={participantUserId}
                onChange={(event) => setParticipantUserId(event.target.value)}
                required
              />
            </label>

            <label>
              Role
              <select
                value={participantRole}
                onChange={(event) => setParticipantRole(event.target.value)}
              >
                <option value="viewer">viewer</option>
              </select>
            </label>

            <button className="primary-button" type="submit" disabled={isParticipantSubmitting}>
              {isParticipantSubmitting ? "Adding..." : "Add participant"}
            </button>
          </form>

          {participantSuccessMessage ? <p className="success">{participantSuccessMessage}</p> : null}
        </section>

        <section className="participants-section">
          <div className="section-heading">
            <h2>Participants</h2>
            <span>{participants.length} total</span>
          </div>

          {participantError ? <p className="error">{participantError}</p> : null}
          {isParticipantsLoading ? <p className="loading-state">Gathering participants...</p> : null}

          {!isParticipantsLoading && participants.length === 0 ? (
            <p className="empty-state">No participants yet.</p>
          ) : null}

          {!isParticipantsLoading && participants.length > 0 ? (
            <ul className="participant-list">
              {participants.map((participant) => (
                <li className="participant-card" key={participant.id}>
                  <div>
                    <strong>User #{participant.userId}</strong>
                    <p>Trip participant</p>
                  </div>
                  <span>{participant.role}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="itinerary-layout">
        <section className="panel itinerary-form-card">
          <h2>Add itinerary item</h2>

          <form className="form-stack" onSubmit={handleItinerarySubmit}>
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

      <div className="expenses-layout">
        <section className="panel expense-form-card">
          <h2>Add expense</h2>

          <form className="form-stack" onSubmit={handleExpenseSubmit}>
            <label>
              Title
              <input
                value={expenseTitle}
                onChange={(event) => setExpenseTitle(event.target.value)}
                required
              />
            </label>

            <div className="expense-inputs">
              <label>
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  required
                />
              </label>

              <label>
                Currency
                <input
                  value={expenseCurrency}
                  onChange={(event) => setExpenseCurrency(event.target.value.toUpperCase())}
                  maxLength={10}
                  required
                />
              </label>
            </div>

            <label>
              Category
              <input
                value={expenseCategory}
                onChange={(event) => setExpenseCategory(event.target.value)}
              />
            </label>

            <button className="primary-button" type="submit" disabled={isExpenseSubmitting}>
              {isExpenseSubmitting ? "Adding..." : "Add expense"}
            </button>
          </form>

          {expenseSuccessMessage ? <p className="success">{expenseSuccessMessage}</p> : null}
        </section>

        <section className="expenses-section">
          <div className="expense-total-card">
            <p className="eyebrow">Total expenses</p>
            <strong>{formatExpenseAmount(totalExpenseAmount, totalExpenseCurrency)}</strong>
          </div>

          <div className="section-heading">
            <h2>Expenses</h2>
            <span>{expenses.length} total</span>
          </div>

          {expenseError ? <p className="error">{expenseError}</p> : null}
          {isExpensesLoading ? <p className="loading-state">Gathering expenses...</p> : null}

          {!isExpensesLoading && expenses.length === 0 ? (
            <p className="empty-state">
              No expenses yet. Add your first cost to keep this trip budget easy to follow.
            </p>
          ) : null}

          {!isExpensesLoading && expenses.length > 0 ? (
            <ul className="expense-list">
              {expenses.map((expense) => (
                <li className="expense-card" key={expense.id}>
                  <div>
                    <strong>{expense.title}</strong>
                    <p>{expense.category || "Uncategorized"}</p>
                  </div>
                  <span>{formatExpenseAmount(expense.amount, expense.currency)}</span>
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
