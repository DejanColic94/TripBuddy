import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import WeatherForecast from "../components/WeatherForecast";
import { API_BASE_URL } from "../config/api";
import { useExpenseConversion } from "../hooks/useExpenseConversion";
import { formatTripDate } from "../types/trip";
import { getFormattingLocale } from "../i18n";

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

function formatExpenseAmount(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
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
  const { i18n, t } = useTranslation();
  const formattingLocale = getFormattingLocale(i18n.resolvedLanguage);
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
          throw new Error(body.error || t("guest.loadFailed"));
        }
        if (active) {
          setData(body as GuestTrip);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : t("guest.loadFailed"));
        }
      });

    return () => {
      active = false;
    };
  }, [guestToken, t]);

  if (error) {
    return (
      <section className="page guest-trip-state-page">
        <section className="panel guest-trip-state-card">
          <p className="eyebrow">{t("guest.unavailable")}</p>
          <h1>{t("guest.unableToOpen")}</h1>
          <p className="error">{error}</p>
          <button className="secondary-button" type="button" onClick={onExit}>
            {t("common.backToHome")}
          </button>
        </section>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="page guest-trip-state-page">
        <section className="panel guest-trip-state-card">
          <p className="eyebrow">{t("guest.access")}</p>
          <h1>{t("guest.opening")}</h1>
          <p className="loading-state">{t("guest.gathering")}</p>
        </section>
      </section>
    );
  }

  const duration = getTripDuration(data.trip.startDate, data.trip.endDate);
  const singleExpenseCurrency = currencies.length === 1 ? currencies[0] : null;
  const displayedTotal =
    convertedTotal !== null
      ? formatExpenseAmount(convertedTotal, displayCurrency, formattingLocale)
      : singleExpenseCurrency
        ? formatExpenseAmount(subtotals[singleExpenseCurrency], singleExpenseCurrency, formattingLocale)
        : t("details.mixedCurrencies");

  return (
    <section className="page trip-details-page guest-trip-page">
      <div className="details-hero">
        <div>
          <p className="eyebrow">{t("guest.readOnly")}</p>
          <h1>{data.trip.name}</h1>
          <p className="trip-description">
            {data.trip.description || t("details.noDescription")}
          </p>
          <div className="guest-access-badges">
            <span className="trip-role-badge trip-role-guest">{t("guest.accessBadge")}</span>
            <span className="guest-name-badge">{t("guest.viewingAs", { name: data.guest.displayName })}</span>
          </div>
        </div>
        <div className="details-actions">
          <button className="secondary-button" type="button" onClick={onExit}>
            {t("common.backToHome")}
          </button>
        </div>
      </div>

      <nav className="trip-section-nav" aria-label={t("details.sections")}>
        <a href="#guest-trip-overview">{t("details.overview")}</a>
        <a href="#guest-trip-itinerary">{t("details.itinerary")}</a>
        <a href="#guest-trip-budget">{t("details.budget")}</a>
      </nav>

      <section
        className="trip-content-section trip-content-section--overview"
        id="guest-trip-overview"
        aria-labelledby="guest-trip-overview-heading"
      >
        <header className="trip-content-section-header">
          <span className="trip-section-number" aria-hidden="true">01</span>
          <div>
            <h2 id="guest-trip-overview-heading">{t("details.overview")}</h2>
            <p>{t("details.overviewDescription")}</p>
          </div>
        </header>

        <WeatherForecast
          destination={data.trip.destination}
          startDate={data.trip.startDate}
          endDate={data.trip.endDate}
        />

        <div className="details-layout">
        <section className="panel trip-info-card">
          <p className="eyebrow">{t("details.overview")}</p>
          <h2>{data.trip.name}</h2>
          <p>{data.trip.description || t("details.noDescription")}</p>
          <p className="guest-access-note">
            {t("guest.note")}
          </p>
        </section>

        <section className="panel metadata-card">
          <h2>{t("details.metadata")}</h2>
          <dl className="metadata-list">
            <div>
              <dt>{t("details.destination")}</dt>
              <dd>{data.trip.destination || "-"}</dd>
            </div>
            <div>
              <dt>{t("details.startDate")}</dt>
              <dd>{formatTripDate(data.trip.startDate, formattingLocale)}</dd>
            </div>
            <div>
              <dt>{t("details.endDate")}</dt>
              <dd>{formatTripDate(data.trip.endDate, formattingLocale)}</dd>
            </div>
            <div>
              <dt>{t("guest.expires")}</dt>
              <dd>{formatTripDate(data.guest.expiresAt, formattingLocale)}</dd>
            </div>
          </dl>
        </section>
        </div>

        <section className="summary-section">
        <div className="section-heading">
          <h2>{t("details.summary")}</h2>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <p>{t("details.duration")}</p>
            <strong>{duration === null ? t("details.unscheduled") : t("details.days", { count: duration })}</strong>
          </article>
          <article className="summary-card">
            <p>{t("details.itineraryItems")}</p>
            <strong>{data.itinerary.length}</strong>
          </article>
          <article className="summary-card">
            <p>{t("details.totalExpenses")}</p>
            <strong>{isConversionLoading ? t("details.converting") : displayedTotal}</strong>
          </article>
          <article className="summary-card">
            <p>{t("details.expenseCount")}</p>
            <strong>{data.expenses.length}</strong>
          </article>
        </div>
        </section>
      </section>

      <section
        className="trip-content-section trip-content-section--itinerary"
        id="guest-trip-itinerary"
        aria-labelledby="guest-trip-itinerary-heading"
      >
        <header className="trip-content-section-header">
          <span className="trip-section-number" aria-hidden="true">02</span>
          <div>
            <h2 id="guest-trip-itinerary-heading">{t("details.itinerary")}</h2>
            <p>{t("details.itineraryDescription")}</p>
          </div>
        </header>

        <div className="itinerary-layout read-only-content-layout">
        <section className="itinerary-section">
          <div className="section-heading">
            <h3>{t("details.scheduledItems")}</h3>
            <span>{t("common.total", { count: data.itinerary.length })}</span>
          </div>

          {data.itinerary.length === 0 ? (
            <p className="empty-state">{t("details.noItinerary")}</p>
          ) : (
            <ul className="itinerary-list">
              {data.itinerary.map((item) => (
                <li className="itinerary-item" key={item.id}>
                  <div className="itinerary-date">{formatTripDate(item.scheduledDate, formattingLocale)}</div>
                  <div className="itinerary-card">
                    <strong>{item.title}</strong>
                    <p>{item.description || t("trips.noDescriptionShort")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </section>

      <section
        className="trip-content-section trip-content-section--budget"
        id="guest-trip-budget"
        aria-labelledby="guest-trip-budget-heading"
      >
        <header className="trip-content-section-header">
          <span className="trip-section-number" aria-hidden="true">03</span>
          <div>
            <h2 id="guest-trip-budget-heading">{t("details.budget")}</h2>
            <p>{t("details.guestBudgetDescription")}</p>
          </div>
        </header>

        <div className="expenses-layout read-only-content-layout">
        <section className="expenses-section">
          <div className="expense-total-card">
            <div className="expense-total-heading">
              <div>
                <p className="eyebrow">{t("details.estimatedTotal")}</p>
                <strong>{isConversionLoading ? t("details.converting") : displayedTotal}</strong>
              </div>
              <label className="conversion-currency">
                {t("details.displayCurrency")}
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
                {t("details.originalTotals", { totals: currencies
                  .map((currency) => formatExpenseAmount(subtotals[currency], currency, formattingLocale))
                  .join(" · ") })}
              </p>
            ) : null}
            {rateDate ? (
              <p className="conversion-note">
                {t("details.ratesNote", { date: rateDate })}
              </p>
            ) : null}
            {conversionError ? <p className="error conversion-error">{conversionError}</p> : null}
          </div>

          <div className="section-heading">
            <h2>{t("details.expenses")}</h2>
            <span>{t("common.total", { count: data.expenses.length })}</span>
          </div>

          {data.expenses.length === 0 ? (
            <p className="empty-state">{t("details.noExpenses")}</p>
          ) : (
            <ul className="expense-list">
              {data.expenses.map((expense) => (
                <li className="expense-card" key={expense.id}>
                  <div>
                    <strong>{expense.title}</strong>
                    <p>{expense.category || t("details.uncategorized")}</p>
                  </div>
                  <span>{formatExpenseAmount(expense.amount, expense.currency, formattingLocale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </section>
    </section>
  );
}

export default GuestTripPage;
