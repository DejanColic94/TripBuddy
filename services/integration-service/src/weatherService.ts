import axios from "axios";
import { searchLocations } from "./locationService";

const requestTimeoutMs = 10000;
const forecastUrl = "https://api.open-meteo.com/v1/forecast";
const historicalUrl = "https://archive-api.open-meteo.com/v1/archive";
const historicalYearCount = 10;
const rainyDayThresholdMm = 0.1;

type WeatherDay = {
  date: string;
  source: "forecast" | "climate";
  weatherCode: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationProbability: number;
  sampleSize?: number;
};

type HistoricalSample = {
  weatherCode: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationMm: number;
};

export class WeatherProviderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function parseUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatUtcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function enumerateDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);

  while (cursor <= end) {
    dates.push(formatUtcDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function monthDay(date: string) {
  return date.slice(5);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mostFrequent(values: number[]) {
  const counts = new Map<number, number>();

  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return values.reduce((selected, value) => {
    const selectedCount = counts.get(selected) ?? 0;
    const valueCount = counts.get(value) ?? 0;
    return valueCount > selectedCount ? value : selected;
  });
}

function normalizeForecastDays(daily: Record<string, unknown>): WeatherDay[] {
  const dates = daily.time;
  const codes = daily.weather_code;
  const maximums = daily.temperature_2m_max;
  const minimums = daily.temperature_2m_min;
  const precipitation = daily.precipitation_probability_max;

  if (
    !Array.isArray(dates) ||
    !Array.isArray(codes) ||
    !Array.isArray(maximums) ||
    !Array.isArray(minimums) ||
    !Array.isArray(precipitation)
  ) {
    throw new Error("Open-Meteo returned an invalid forecast");
  }

  return dates.map((date, index) => {
    const day = {
      date: String(date),
      source: "forecast" as const,
      weatherCode: Number(codes[index]),
      temperatureMaxC: Number(maximums[index]),
      temperatureMinC: Number(minimums[index]),
      precipitationProbability: Number(precipitation[index]),
    };

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
      Object.values(day)
        .filter((value): value is number => typeof value === "number")
        .some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Open-Meteo returned an invalid forecast");
    }

    return day;
  });
}

function buildHistoricalSamples(daily: Record<string, unknown>) {
  const dates = daily.time;
  const codes = daily.weather_code;
  const maximums = daily.temperature_2m_max;
  const minimums = daily.temperature_2m_min;
  const precipitation = daily.precipitation_sum;

  if (
    !Array.isArray(dates) ||
    !Array.isArray(codes) ||
    !Array.isArray(maximums) ||
    !Array.isArray(minimums) ||
    !Array.isArray(precipitation)
  ) {
    throw new Error("Open-Meteo returned invalid historical weather");
  }

  const samples = new Map<string, HistoricalSample[]>();

  dates.forEach((date, index) => {
    const sample = {
      weatherCode: Number(codes[index]),
      temperatureMaxC: Number(maximums[index]),
      temperatureMinC: Number(minimums[index]),
      precipitationMm: Number(precipitation[index]),
    };

    if (Object.values(sample).some((value) => !Number.isFinite(value))) return;

    const key = monthDay(String(date));
    samples.set(key, [...(samples.get(key) ?? []), sample]);
  });

  return samples;
}

function createClimateDay(date: string, samples: HistoricalSample[]): WeatherDay {
  return {
    date,
    source: "climate",
    weatherCode: mostFrequent(samples.map((sample) => sample.weatherCode)),
    temperatureMaxC: average(samples.map((sample) => sample.temperatureMaxC)),
    temperatureMinC: average(samples.map((sample) => sample.temperatureMinC)),
    precipitationProbability: Math.round(
      (samples.filter((sample) => sample.precipitationMm >= rainyDayThresholdMm).length /
        samples.length) *
        100
    ),
    sampleSize: samples.length,
  };
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
  const todayValue = formatUtcDate(today);
  const lastForecastValue = formatUtcDate(lastForecastDate);
  const targetDates = enumerateDates(startDate, endDate);
  const forecastDates = targetDates.filter(
    (date) => date >= todayValue && date <= lastForecastValue
  );
  const climateDates = targetDates.filter(
    (date) => date < todayValue || date > lastForecastValue
  );

  try {
    const [location] = await searchLocations(destination, 1);
    if (!location) throw new WeatherProviderError("Destination not found", 404);

    const days: WeatherDay[] = [];
    let timezone = location.timezone;

    if (forecastDates.length > 0) {
      const forecast = await axios.get(forecastUrl, {
        timeout: requestTimeoutMs,
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          start_date: forecastDates[0],
          end_date: forecastDates[forecastDates.length - 1],
          daily:
            "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
          timezone: "auto",
        },
      });

      timezone = forecast.data?.timezone ?? timezone;
      days.push(...normalizeForecastDays(forecast.data?.daily ?? {}));
    }

    const climatePeriod =
      climateDates.length > 0
        ? {
            startYear: today.getUTCFullYear() - historicalYearCount,
            endYear: today.getUTCFullYear() - 1,
          }
        : null;

    if (climatePeriod) {
      const historical = await axios.get(historicalUrl, {
        timeout: requestTimeoutMs,
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          start_date: `${climatePeriod.startYear}-01-01`,
          end_date: `${climatePeriod.endYear}-12-31`,
          daily:
            "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
          models: "era5",
          timezone: "auto",
        },
      });
      const samplesByMonthDay = buildHistoricalSamples(historical.data?.daily ?? {});

      climateDates.forEach((date) => {
        const samples = samplesByMonthDay.get(monthDay(date));
        if (samples?.length) days.push(createClimateDay(date, samples));
      });
    }

    const daysByDate = new Map(days.map((day) => [day.date, day]));
    if (
      daysByDate.size !== targetDates.length ||
      targetDates.some((date) => !daysByDate.has(date))
    ) {
      throw new Error("Open-Meteo returned incomplete weather data");
    }

    return {
      available: true,
      location: {
        name: location.name,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone,
      },
      days: targetDates.map((date) => daysByDate.get(date) as WeatherDay),
      climatePeriod,
      attribution: "Weather data by Open-Meteo.com",
    };
  } catch (error) {
    if (error instanceof WeatherProviderError) throw error;
    console.error("[INTEGRATION] Open-Meteo request failed:", error);
    throw new WeatherProviderError("Weather provider is temporarily unavailable", 502);
  }
}
