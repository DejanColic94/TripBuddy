import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config/api";

type ConvertibleExpense = {
  amount: number;
  currency: string;
};

type ExchangeRateResponse = {
  convertedAmount: number;
  date: string;
};

export function useExpenseConversion(
  expenses: ConvertibleExpense[],
  conversionCurrency: string
) {
  const [convertedTotal, setConvertedTotal] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const subtotals = useMemo(
    () =>
      expenses.reduce<Record<string, number>>((totals, expense) => {
        const currency = expense.currency.toUpperCase();
        totals[currency] = (totals[currency] ?? 0) + expense.amount;
        return totals;
      }, {}),
    [expenses]
  );
  const currencies = useMemo(() => Object.keys(subtotals).sort(), [subtotals]);

  useEffect(() => {
    const controller = new AbortController();

    if (currencies.length === 0) {
      setConvertedTotal(0);
      setRateDate("");
      setError("");
      return () => controller.abort();
    }

    const loadConvertedTotal = async () => {
      setIsLoading(true);
      setError("");

      try {
        const conversions = await Promise.all(
          currencies.map(async (from) => {
            const amount = subtotals[from];
            if (from === conversionCurrency) {
              return { convertedAmount: amount, date: "" };
            }

            const searchParams = new URLSearchParams({
              from,
              to: conversionCurrency,
              amount: String(amount),
            });
            const response = await fetch(
              `${API_BASE_URL}/integrations/exchange-rate?${searchParams.toString()}`,
              { signal: controller.signal }
            );
            const data = (await response.json()) as
              | ExchangeRateResponse
              | { error?: string };

            if (!response.ok || !("convertedAmount" in data)) {
              throw new Error(
                ("error" in data && data.error) || "Failed to convert expenses"
              );
            }

            return data;
          })
        );
        const dates = conversions
          .map((conversion) => conversion.date)
          .filter(Boolean)
          .sort();

        setConvertedTotal(
          conversions.reduce(
            (total, conversion) => total + conversion.convertedAmount,
            0
          )
        );
        setRateDate(dates[dates.length - 1] ?? "");
      } catch (conversionError) {
        if (
          conversionError instanceof DOMException &&
          conversionError.name === "AbortError"
        ) {
          return;
        }
        setConvertedTotal(null);
        setError(
          conversionError instanceof Error
            ? conversionError.message
            : "Failed to convert expenses"
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadConvertedTotal();
    return () => controller.abort();
  }, [conversionCurrency, currencies, subtotals]);

  return {
    convertedTotal,
    rateDate,
    isLoading,
    error,
    subtotals,
    currencies,
  };
}
