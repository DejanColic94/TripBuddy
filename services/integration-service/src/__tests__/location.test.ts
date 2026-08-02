import axios from "axios";
import request from "supertest";
import app from "../app";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  mockedAxios.get.mockReset();
});

it("returns normalized location search results", async () => {
  mockedAxios.get.mockResolvedValueOnce({
    data: {
      results: [
        {
          id: 792680,
          name: "Belgrade",
          admin1: "Central Serbia",
          country: "Serbia",
          country_code: "RS",
          latitude: 44.80401,
          longitude: 20.46513,
          timezone: "Europe/Belgrade",
        },
      ],
    },
  });

  const response = await request(app).get("/locations").query({ query: "Belgrade" });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    locations: [
      {
        id: 792680,
        name: "Belgrade",
        displayName: "Belgrade, Central Serbia, Serbia",
        admin1: "Central Serbia",
        country: "Serbia",
        countryCode: "RS",
        latitude: 44.80401,
        longitude: 20.46513,
        timezone: "Europe/Belgrade",
      },
    ],
    attribution: "Location data by GeoNames via Open-Meteo.com",
  });
  expect(mockedAxios.get).toHaveBeenCalledWith(
    "https://geocoding-api.open-meteo.com/v1/search",
    {
      timeout: 5000,
      params: { name: "Belgrade", count: 8, language: "en", format: "json" },
    }
  );
});

it("returns an empty location list when nothing matches", async () => {
  mockedAxios.get.mockResolvedValueOnce({ data: {} });

  const response = await request(app).get("/locations").query({ query: "Nowhere" });

  expect(response.status).toBe(200);
  expect(response.body.locations).toEqual([]);
});

it.each(["", "A"])("rejects a location query shorter than two characters", async (query) => {
  const response = await request(app).get("/locations").query({ query });

  expect(response.status).toBe(400);
  expect(mockedAxios.get).not.toHaveBeenCalled();
});

it("maps location provider failures to 502", async () => {
  mockedAxios.get.mockRejectedValueOnce(new Error("timeout"));

  const response = await request(app).get("/locations").query({ query: "Belgrade" });

  expect(response.status).toBe(502);
  expect(response.body.error).toBe("Location provider is temporarily unavailable");
});
