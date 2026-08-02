import { API_BASE_URL } from "../config/api";
import type { LocationSearchResult } from "../types/location";

type LocationSearchResponse = {
  locations?: LocationSearchResult[];
  error?: string;
};

export async function searchLocations(query: string, signal?: AbortSignal) {
  const response = await fetch(
    `${API_BASE_URL}/integrations/locations?query=${encodeURIComponent(query)}`,
    { signal }
  );
  const data = (await response.json()) as LocationSearchResponse;

  if (!response.ok) {
    throw new Error(data.error || "Unable to search destinations");
  }

  if (!Array.isArray(data.locations)) {
    throw new Error("Location search returned an invalid response");
  }

  return data.locations.filter(
    (location) =>
      Number.isInteger(location.id) &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      Boolean(location.displayName) &&
      Boolean(location.timezone) &&
      /^[A-Za-z]{2}$/.test(location.countryCode)
  );
}
