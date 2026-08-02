import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import WeatherForecast from "./WeatherForecast";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("renders a normalized weather forecast with attribution", async () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          available: true,
          location: { name: "Lisbon", country: "Portugal", timezone: "Europe/Lisbon" },
          days: [
            {
              date: "2026-07-28",
              source: "forecast",
              weatherCode: 1,
              temperatureMaxC: 26,
              temperatureMinC: 18,
              precipitationProbability: 15,
            },
          ],
          climatePeriod: null,
          attribution: "Weather data by Open-Meteo.com",
        }),
    } as Response)
  );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <WeatherForecast
      destination="Lisbon, Portugal"
      startDate="2026-07-28"
      endDate="2026-07-28"
    />
  );

  expect(await screen.findByText("Lisbon, Portugal")).toBeInTheDocument();
  expect(screen.getByText("Mostly clear")).toBeInTheDocument();
  expect(screen.getByText("🌤️")).toBeInTheDocument();
  expect(screen.getByText("26°")).toBeInTheDocument();
  expect(screen.getByText("18°C")).toBeInTheDocument();
  expect(screen.getByText("15% precipitation")).toBeInTheDocument();
  expect(screen.getByText("Forecast")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open-Meteo.com" })).toHaveAttribute(
    "href",
    "https://open-meteo.com/"
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining(
      "/integrations/weather?destination=Lisbon%2C+Portugal&startDate=2026-07-28&endDate=2026-07-28"
    )
  );
});

it("does not request weather when trip details are incomplete", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const { container } = render(
    <WeatherForecast destination="Lisbon" startDate={null} endDate={null} />
  );

  expect(container).toBeEmptyDOMElement();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("labels distant weather as historical conditions rather than a forecast", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            available: true,
            location: { name: "Tokyo", country: "Japan", timezone: "Asia/Tokyo" },
            days: [
              {
                date: "2027-01-01",
                source: "climate",
                weatherCode: 3,
                temperatureMaxC: 10.4,
                temperatureMinC: 2.2,
                precipitationProbability: 30,
                sampleSize: 10,
              },
            ],
            climatePeriod: { startYear: 2016, endYear: 2025 },
            attribution: "Weather data by Open-Meteo.com",
          }),
      } as Response)
    )
  );

  render(
    <WeatherForecast
      destination="Tokyo"
      startDate="2027-01-01"
      endDate="2027-01-05"
    />
  );

  expect(await screen.findByText("Typical")).toBeInTheDocument();
  expect(screen.getByText(/not a forecast/i)).toBeInTheDocument();
  expect(screen.getByText("~10°")).toBeInTheDocument();
  expect(screen.getByText("Rain on 30% of historical days")).toBeInTheDocument();
});

it("distinguishes forecast and typical days for mixed trips", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            available: true,
            location: { name: "Lisbon", country: "Portugal", timezone: "Europe/Lisbon" },
            days: [
              {
                date: "2026-08-15",
                source: "forecast",
                weatherCode: 0,
                temperatureMaxC: 29,
                temperatureMinC: 20,
                precipitationProbability: 5,
              },
              {
                date: "2026-08-16",
                source: "climate",
                weatherCode: 1,
                temperatureMaxC: 28,
                temperatureMinC: 19,
                precipitationProbability: 10,
                sampleSize: 10,
              },
            ],
            climatePeriod: { startYear: 2016, endYear: 2025 },
            attribution: "Weather data by Open-Meteo.com",
          }),
      } as Response)
    )
  );

  render(
    <WeatherForecast
      destination="Lisbon"
      startDate="2026-08-15"
      endDate="2026-08-16"
    />
  );

  expect(await screen.findByText(/Later dates use typical daily conditions/)).toBeInTheDocument();
  expect(screen.getByText("Forecast")).toBeInTheDocument();
  expect(screen.getByText("Typical")).toBeInTheDocument();
});
