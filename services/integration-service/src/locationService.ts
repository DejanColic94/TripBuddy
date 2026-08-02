import axios from "axios";

const requestTimeoutMs = 5000;
const geocodingUrl = "https://geocoding-api.open-meteo.com/v1/search";

type OpenMeteoLocation = {
  id?: unknown;
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  country?: unknown;
  country_code?: unknown;
  admin1?: unknown;
};

export type LocationSearchResult = {
  id: number;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  countryCode?: string;
  admin1?: string;
};

export class LocationProviderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeLocation(location: OpenMeteoLocation): LocationSearchResult | null {
  if (
    !Number.isInteger(location.id) ||
    typeof location.name !== "string" ||
    !location.name.trim() ||
    typeof location.latitude !== "number" ||
    !Number.isFinite(location.latitude) ||
    typeof location.longitude !== "number" ||
    !Number.isFinite(location.longitude) ||
    typeof location.timezone !== "string" ||
    !location.timezone.trim()
  ) {
    return null;
  }

  const name = location.name.trim();
  const admin1 = optionalString(location.admin1);
  const country = optionalString(location.country);
  const countryCode = optionalString(location.country_code);
  const seen = new Set<string>();
  const displayName = [name, admin1, country]
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const key = part.toLocaleLowerCase("en");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");

  return {
    id: location.id as number,
    name,
    displayName,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone.trim(),
    country,
    countryCode,
    admin1,
  };
}

export async function searchLocations(query: string, count = 8) {
  try {
    const response = await axios.get(geocodingUrl, {
      timeout: requestTimeoutMs,
      params: { name: query, count, language: "en", format: "json" },
    });
    const results = response.data?.results;

    if (results === undefined) return [];
    if (!Array.isArray(results)) {
      throw new Error("Open-Meteo returned an invalid location response");
    }

    return results
      .map((location: OpenMeteoLocation) => normalizeLocation(location))
      .filter((location): location is LocationSearchResult => location !== null);
  } catch (error) {
    if (error instanceof LocationProviderError) throw error;
    throw new LocationProviderError("Location provider is temporarily unavailable", 502);
  }
}
