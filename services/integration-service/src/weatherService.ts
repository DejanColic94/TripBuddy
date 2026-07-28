import axios from "axios";

const requestTimeoutMs = 5000;
const geocodingUrl = "https://geocoding-api.open-meteo.com/v1/search";
const forecastUrl = "https://api.open-meteo.com/v1/forecast";

export class WeatherProviderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function parseUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getWeatherForecast(
  destination: string,
  startDate: string,
  endDate: string
) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const lastForecastDate = new Date(today);
  lastForecastDate.setUTCDate(lastForecastDate.getUTCDate() + 15);

  if (parseUtcDate(endDate) < today || parseUtcDate(startDate) > lastForecastDate) {
    return {
      available: false,
      reason: "Forecast is available only for the next 16 days",
      attribution: "Weather data by Open-Meteo.com",
    };
  }

  try {
    const geocoding = await axios.get(geocodingUrl, {
      timeout: requestTimeoutMs,
      params: { name: destination, count: 1, language: "en", format: "json" },
    });
    const location = geocoding.data?.results?.[0];
    if (!location) throw new WeatherProviderError("Destination not found", 404);

    const effectiveStart = parseUtcDate(startDate) < today
      ? today.toISOString().slice(0, 10)
      : startDate;
    const effectiveEnd = parseUtcDate(endDate) > lastForecastDate
      ? lastForecastDate.toISOString().slice(0, 10)
      : endDate;
    const forecast = await axios.get(forecastUrl, {
      timeout: requestTimeoutMs,
      params: {
        latitude: location.latitude,
        longitude: location.longitude,
        start_date: effectiveStart,
        end_date: effectiveEnd,
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        timezone: "auto",
      },
    });
    const daily = forecast.data?.daily;
    if (!daily?.time) throw new Error("Open-Meteo returned an invalid forecast");

    return {
      available: true,
      location: {
        name: location.name,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: forecast.data.timezone,
      },
      days: daily.time.map((date: string, index: number) => ({
        date,
        weatherCode: daily.weather_code[index],
        temperatureMaxC: daily.temperature_2m_max[index],
        temperatureMinC: daily.temperature_2m_min[index],
        precipitationProbability: daily.precipitation_probability_max[index],
      })),
      attribution: "Weather data by Open-Meteo.com",
    };
  } catch (error) {
    if (error instanceof WeatherProviderError) throw error;
    console.error("[INTEGRATION] Open-Meteo request failed:", error);
    throw new WeatherProviderError("Weather provider is temporarily unavailable", 502);
  }
}
