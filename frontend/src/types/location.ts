export type LocationSearchResult = {
  id: number;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  countryCode: string;
  admin1?: string;
};
