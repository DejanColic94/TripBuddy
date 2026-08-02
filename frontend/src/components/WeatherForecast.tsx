import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

type WeatherResponse =
  | {
      available: false;
      reason: string;
      attribution: string;
    }
  | {
      available: true;
      location: { name: string; country?: string; timezone: string };
      days: Array<{
        date: string;
        source: "forecast" | "climate";
        weatherCode: number;
        temperatureMaxC: number;
        temperatureMinC: number;
        precipitationProbability: number;
        sampleSize?: number;
      }>;
      climatePeriod: { startYear: number; endYear: number } | null;
      attribution: string;
    };

const weatherLabels: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  95: "Thunderstorm",
};

function getWeatherVisual(code: number) {
  if (code === 0) return { icon: "☀️", tone: "sunny" };
  if (code === 1) return { icon: "🌤️", tone: "sunny" };
  if (code === 2) return { icon: "⛅", tone: "cloudy" };
  if (code === 3) return { icon: "☁️", tone: "cloudy" };
  if (code === 45 || code === 48) return { icon: "🌫️", tone: "cloudy" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", tone: "rainy" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { icon: "🌧️", tone: "rainy" };
  }
  if (code >= 71 && code <= 77) return { icon: "🌨️", tone: "snowy" };
  if (code >= 95) return { icon: "⛈️", tone: "stormy" };
  return { icon: "🌡️", tone: "neutral" };
}

function WeatherForecast({
  destination,
  startDate,
  endDate,
}: {
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
}) {
  const [forecast, setForecast] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!destination || !startDate || !endDate) {
      setForecast(null);
      setError("");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      destination,
      startDate: startDate.slice(0, 10),
      endDate: endDate.slice(0, 10),
    });

    fetch(`${API_BASE_URL}/integrations/weather?${query}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load weather");
        if (active) setForecast(data as WeatherResponse);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Failed to load weather");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [destination, endDate, startDate]);

  if (!destination || !startDate || !endDate) return null;

  const hasForecast = forecast?.available
    ? forecast.days.some((day) => day.source === "forecast")
    : false;
  const hasClimate = forecast?.available
    ? forecast.days.some((day) => day.source === "climate")
    : false;

  return (
    <section className="panel weather-panel">
      <div className="section-heading">
        <h2>Weather outlook</h2>
        <span>Open-Meteo</span>
      </div>
      {loading ? <p className="loading-state">Checking the weather...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {forecast && !forecast.available ? (
        <p className="empty-state">{forecast.reason}</p>
      ) : null}
      {forecast?.available ? (
        <>
          <p className="page-subtitle">
            {forecast.location.name}
            {forecast.location.country ? `, ${forecast.location.country}` : ""}
          </p>
          {hasClimate && forecast.climatePeriod ? (
            <p className="weather-method-note">
              {hasForecast
                ? "Forecast data is shown where available. Later dates use typical daily conditions"
                : "These are typical historical conditions, not a forecast"}{" "}
              from {forecast.climatePeriod.startYear}–{forecast.climatePeriod.endYear}.
            </p>
          ) : null}
          <div className="weather-grid">
            {forecast.days.map((day, index) => {
              const visual = getWeatherVisual(day.weatherCode);
              const isToday =
                day.date === new Date().toISOString().slice(0, 10);

              return (
                <article
                  className={`weather-card weather-card--${visual.tone}${
                    day.source === "climate" ? " weather-card--climate" : ""
                  }${index === 0 ? " weather-card--first" : ""}`}
                  key={day.date}
                >
                  <div className="weather-card-heading">
                    <strong>
                      {new Date(`${day.date}T00:00:00`).toLocaleDateString("en", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </strong>
                    <span className="weather-card-badges">
                      {isToday ? <span className="weather-today">Today</span> : null}
                      <span
                        className={`weather-source weather-source--${day.source}`}
                      >
                        {day.source === "forecast" ? "Forecast" : "Typical"}
                      </span>
                    </span>
                  </div>
                  <span className="weather-icon" aria-hidden="true">
                    {visual.icon}
                  </span>
                  <p className="weather-condition">
                    {weatherLabels[day.weatherCode] ?? "Variable conditions"}
                  </p>
                  <p className="weather-temperature">
                    <strong>
                      {day.source === "climate" ? "~" : ""}
                      {Math.round(day.temperatureMaxC)}°
                    </strong>
                    <span>
                      {day.source === "climate" ? "~" : ""}
                      {Math.round(day.temperatureMinC)}°C
                    </span>
                  </p>
                  <p className="weather-precipitation">
                    <span aria-hidden="true">💧</span>
                    {day.source === "forecast"
                      ? `${day.precipitationProbability}% precipitation`
                      : `Rain on ${day.precipitationProbability}% of historical days`}
                  </p>
                </article>
              );
            })}
          </div>
          <small className="weather-attribution">
            Weather data by{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo.com
            </a>
          </small>
        </>
      ) : null}
    </section>
  );
}

export default WeatherForecast;
