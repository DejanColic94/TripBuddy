import axios from "axios";
import request from "supertest";
import app from "../app";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

function dateFromToday(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function historicalDatesFor(targetDate: string) {
  const monthAndDay = targetDate.slice(5);
  const currentYear = new Date().getUTCFullYear();
  return [currentYear - 3, currentYear - 2, currentYear - 1].map(
    (year) => `${year}-${monthAndDay}`
  );
}

const lisbonLocation = {
  data: {
    results: [
      {
        id: 2267057,
        name: "Lisbon",
        country: "Portugal",
        country_code: "PT",
        latitude: 38.72,
        longitude: -9.14,
        timezone: "Europe/Lisbon",
      },
    ],
  },
};

beforeEach(() => {
  mockedAxios.get.mockReset();
});

it("returns a normalized destination forecast", async () => {
  mockedAxios.get
    .mockResolvedValueOnce(lisbonLocation)
    .mockResolvedValueOnce({
      data: {
        timezone: "Europe/Lisbon",
        daily: {
          time: [dateFromToday(1)],
          weather_code: [1],
          temperature_2m_max: [24],
          temperature_2m_min: [16],
          precipitation_probability_max: [10],
        },
      },
    });

  const response = await request(app).get("/weather").query({
    destination: "Lisbon",
    startDate: dateFromToday(1),
    endDate: dateFromToday(1),
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.objectContaining({
      available: true,
      location: expect.objectContaining({ name: "Lisbon", country: "Portugal" }),
      days: [
        expect.objectContaining({
          source: "forecast",
          weatherCode: 1,
          temperatureMaxC: 24,
          temperatureMinC: 16,
          precipitationProbability: 10,
        }),
      ],
      climatePeriod: null,
      attribution: "Weather data by Open-Meteo.com",
    })
  );
  expect(mockedAxios.get).toHaveBeenCalledTimes(2);
});

it("returns historical climate averages for distant trips", async () => {
  const targetDate = dateFromToday(30);
  mockedAxios.get
    .mockResolvedValueOnce(lisbonLocation)
    .mockResolvedValueOnce({
      data: {
        daily: {
          time: historicalDatesFor(targetDate),
          weather_code: [1, 1, 3],
          temperature_2m_max: [24, 26, 25],
          temperature_2m_min: [14, 16, 15],
          precipitation_sum: [0, 2, 0],
        },
      },
    });

  const response = await request(app).get("/weather").query({
    destination: "Lisbon",
    startDate: targetDate,
    endDate: targetDate,
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.objectContaining({
      available: true,
      climatePeriod: expect.objectContaining({
        startYear: expect.any(Number),
        endYear: expect.any(Number),
      }),
      days: [
        expect.objectContaining({
          date: targetDate,
          source: "climate",
          weatherCode: 1,
          temperatureMaxC: 25,
          temperatureMinC: 15,
          precipitationProbability: 33,
          sampleSize: 3,
        }),
      ],
    })
  );
  expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  expect(mockedAxios.get).toHaveBeenLastCalledWith(
    "https://archive-api.open-meteo.com/v1/archive",
    expect.objectContaining({
      params: expect.objectContaining({ models: "era5" }),
    })
  );
});

it("combines forecast and climate data for trips crossing the forecast window", async () => {
  const forecastDate = dateFromToday(15);
  const climateDate = dateFromToday(16);
  mockedAxios.get
    .mockResolvedValueOnce(lisbonLocation)
    .mockResolvedValueOnce({
      data: {
        timezone: "Europe/Lisbon",
        daily: {
          time: [forecastDate],
          weather_code: [2],
          temperature_2m_max: [23],
          temperature_2m_min: [15],
          precipitation_probability_max: [20],
        },
      },
    })
    .mockResolvedValueOnce({
      data: {
        daily: {
          time: historicalDatesFor(climateDate),
          weather_code: [3, 3, 2],
          temperature_2m_max: [22, 24, 23],
          temperature_2m_min: [14, 16, 15],
          precipitation_sum: [0, 1, 0],
        },
      },
    });

  const response = await request(app).get("/weather").query({
    destination: "Lisbon",
    startDate: forecastDate,
    endDate: climateDate,
  });

  expect(response.status).toBe(200);
  expect(response.body.days).toEqual([
    expect.objectContaining({ date: forecastDate, source: "forecast" }),
    expect.objectContaining({ date: climateDate, source: "climate" }),
  ]);
  expect(mockedAxios.get).toHaveBeenCalledTimes(3);
});

it("rejects invalid inputs", async () => {
  const response = await request(app).get("/weather").query({
    destination: "",
    startDate: "tomorrow",
    endDate: "later",
  });
  expect(response.status).toBe(400);
});

it("returns 404 when geocoding cannot find the destination", async () => {
  mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } });
  const response = await request(app).get("/weather").query({
    destination: "NotARealPlace",
    startDate: dateFromToday(1),
    endDate: dateFromToday(2),
  });
  expect(response.status).toBe(404);
  expect(response.body.error).toBe("Destination not found");
});

it("maps provider failures to 502", async () => {
  mockedAxios.get.mockRejectedValueOnce(new Error("timeout"));
  const response = await request(app).get("/weather").query({
    destination: "Lisbon",
    startDate: dateFromToday(1),
    endDate: dateFromToday(2),
  });
  expect(response.status).toBe(502);
});
