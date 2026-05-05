import type { CardmarketPriceSummary } from "../cardmarket/cardmarket.types";

function getNumericPriceField(
  price: CardmarketPriceSummary | undefined,
  keys: string[],
) {
  if (!price) {
    return undefined;
  }

  const priceRecord = price as Record<string, unknown>;

  for (const key of keys) {
    const value = priceRecord[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = Number(value.replace(",", "."));

      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return undefined;
}

export function getCardexTrendPrice(price?: CardmarketPriceSummary) {
  return getNumericPriceField(price, [
    "trend",
    "trendPrice",
    "trendPriceEur",
    "trendPriceEUR",
  ]);
}

export function getCardexDisplayPrice(price?: CardmarketPriceSummary) {
  return getCardexTrendPrice(price);
}

export function getCardexSortPrice(price?: CardmarketPriceSummary) {
  return getCardexTrendPrice(price);
}
