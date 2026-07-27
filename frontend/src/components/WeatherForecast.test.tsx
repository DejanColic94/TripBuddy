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
              weatherCode: 1,
              temperatureMaxC: 26,
              temperatureMinC: 18,
              precipitationProbability: 15,
            },
          ],
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
  expect(screen.getByText("18° / 26°C")).toBeInTheDocument();
  expect(screen.getByText("Weather data by Open-Meteo.com")).toBeInTheDocument();
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

it("explains when the forecast window is not available yet", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            available: false,
            reason: "Forecast is available only for the next 16 days",
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

  expect(
    await screen.findByText("Forecast is available only for the next 16 days")
  ).toBeInTheDocument();
});
