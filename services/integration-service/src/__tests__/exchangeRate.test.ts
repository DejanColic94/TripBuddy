import axios from "axios";
import request from "supertest";
import app from "../app";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  mockedAxios.get.mockReset();
  mockedAxios.isAxiosError.mockReset();
});

it("returns a normalized currency conversion", async () => {
  mockedAxios.get.mockResolvedValueOnce({
    data: { date: "2026-07-28", base: "EUR", quote: "USD", rate: 1.1725 },
  });

  const response = await request(app).get("/exchange-rate").query({
    from: "eur",
    to: "usd",
    amount: "25.50",
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    from: "EUR",
    to: "USD",
    amount: 25.5,
    rate: 1.1725,
    convertedAmount: 29.9,
    date: "2026-07-28",
    attribution: "Exchange rates by Frankfurter.dev",
  });
  expect(mockedAxios.get).toHaveBeenCalledWith(
    "https://api.frankfurter.dev/v2/rate/EUR/USD",
    { timeout: 5000 }
  );
});

it("converts identical currencies without calling the provider", async () => {
  const response = await request(app).get("/exchange-rate").query({
    from: "EUR",
    to: "EUR",
    amount: "10",
  });

  expect(response.status).toBe(200);
  expect(response.body.rate).toBe(1);
  expect(response.body.convertedAmount).toBe(10);
  expect(mockedAxios.get).not.toHaveBeenCalled();
});

it.each([
  [{ from: "EU", to: "USD", amount: "10" }],
  [{ from: "EUR", to: "USD", amount: "0" }],
  [{ from: "EUR", to: "USD", amount: "not-a-number" }],
])("rejects invalid conversion input", async (query) => {
  const response = await request(app).get("/exchange-rate").query(query);

  expect(response.status).toBe(400);
  expect(mockedAxios.get).not.toHaveBeenCalled();
});

it("maps unsupported currency pairs to 400", async () => {
  const providerError = {
    response: { status: 422 },
  };
  mockedAxios.get.mockRejectedValueOnce(providerError);
  mockedAxios.isAxiosError.mockImplementation(
    (error) => error === providerError
  );

  const response = await request(app).get("/exchange-rate").query({
    from: "AAA",
    to: "BBB",
    amount: "10",
  });

  expect(response.status).toBe(400);
  expect(response.body.error).toBe("Unsupported currency pair");
});

it("maps provider failures to 502", async () => {
  mockedAxios.get.mockRejectedValueOnce(new Error("timeout"));
  mockedAxios.isAxiosError.mockReturnValue(false);

  const response = await request(app).get("/exchange-rate").query({
    from: "EUR",
    to: "USD",
    amount: "10",
  });

  expect(response.status).toBe(502);
  expect(response.body.error).toBe(
    "Exchange rate provider is temporarily unavailable"
  );
});
