import axios from "axios";

const requestTimeoutMs = 5000;
const frankfurterUrl = "https://api.frankfurter.dev/v2/rate";

export class ExchangeRateProviderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export interface ExchangeRateConversion {
  from: string;
  to: string;
  amount: number;
  rate: number;
  convertedAmount: number;
  date: string;
  attribution: string;
}

export async function convertCurrency(
  from: string,
  to: string,
  amount: number
): Promise<ExchangeRateConversion> {
  if (from === to) {
    return {
      from,
      to,
      amount,
      rate: 1,
      convertedAmount: amount,
      date: new Date().toISOString().slice(0, 10),
      attribution: "Exchange rates by Frankfurter.dev",
    };
  }

  try {
    const response = await axios.get(
      `${frankfurterUrl}/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
      { timeout: requestTimeoutMs }
    );
    const rate = Number(response.data?.rate);
    const date = response.data?.date;

    if (!Number.isFinite(rate) || rate <= 0 || typeof date !== "string") {
      throw new Error("Frankfurter returned an invalid exchange rate");
    }

    return {
      from,
      to,
      amount,
      rate,
      convertedAmount: Number((amount * rate).toFixed(2)),
      date,
      attribution: "Exchange rates by Frankfurter.dev",
    };
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response &&
      [400, 404, 422].includes(error.response.status)
    ) {
      throw new ExchangeRateProviderError("Unsupported currency pair", 400);
    }

    console.error("[INTEGRATION] Frankfurter request failed:", error);
    throw new ExchangeRateProviderError(
      "Exchange rate provider is temporarily unavailable",
      502
    );
  }
}
