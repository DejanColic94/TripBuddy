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
        weatherCode: number;
        temperatureMaxC: number;
        temperatureMinC: number;
        precipitationProbability: number;
      }>;
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

  return (
    <section className="panel weather-panel">
      <div className="section-heading">
        <h2>Weather forecast</h2>
        <span>Open-Meteo</span>
      </div>
      {loading ? <p className="loading-state">Checking the forecast...</p> : null}
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
          <div className="weather-grid">
            {forecast.days.map((day) => (
              <article className="weather-card" key={day.date}>
                <strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</strong>
                <p>{weatherLabels[day.weatherCode] ?? "Variable conditions"}</p>
                <p>{Math.round(day.temperatureMinC)}° / {Math.round(day.temperatureMaxC)}°C</p>
                <p>{day.precipitationProbability}% precipitation</p>
              </article>
            ))}
          </div>
          <small>{forecast.attribution}</small>
        </>
      ) : null}
    </section>
  );
}

export default WeatherForecast;
