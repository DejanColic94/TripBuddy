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

beforeEach(() => {
  mockedAxios.get.mockReset();
});

it("returns a normalized destination forecast", async () => {
  mockedAxios.get
    .mockResolvedValueOnce({
      data: {
        results: [{ name: "Lisbon", country: "Portugal", latitude: 38.72, longitude: -9.14 }],
      },
    })
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
          weatherCode: 1,
          temperatureMaxC: 24,
          temperatureMinC: 16,
          precipitationProbability: 10,
        }),
      ],
      attribution: "Weather data by Open-Meteo.com",
    })
  );
  expect(mockedAxios.get).toHaveBeenCalledTimes(2);
});

it("returns unavailable without calling Open-Meteo for distant trips", async () => {
  const response = await request(app).get("/weather").query({
    destination: "Lisbon",
    startDate: dateFromToday(30),
    endDate: dateFromToday(35),
  });

  expect(response.status).toBe(200);
  expect(response.body.available).toBe(false);
  expect(mockedAxios.get).not.toHaveBeenCalled();
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
