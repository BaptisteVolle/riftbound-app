import { getDisplayPrice } from "../cardmarket/cardmarket-prices.service";
import { CardmarketPriceSummary } from "../cardmarket/cardmarket.types";
import { normalizeCollectorNumber } from "../riftcodex/riftcodex.service";
import { CollectionEntry, CollectionRow } from "./collection.types";

export type CollectionSortKey =
  | "set"
  | "name"
  | "color"
  | "normal"
  | "foil"
  | "total"
  | "price";

export type CollectionSortDirection = "asc" | "desc";
export type CollectionPrintingFilter = "all" | "normal" | "foil";

export const COLLECTION_SORT_OPTIONS: CollectionSortKey[] = [
  "set",
  "name",
  "color",
  "normal",
  "foil",
  "total",
  "price",
];

export function getCollectionDisplayPrinting(entry: CollectionEntry) {
  return entry.foilQuantity > 0 && entry.normalQuantity === 0
    ? "foil"
    : "normal";
}

function getNormalValue(price?: CardmarketPriceSummary) {
  return price?.trend ?? price?.avg ?? price?.low ?? 0;
}

function getFoilValue(price?: CardmarketPriceSummary) {
  return price?.trendFoil ?? price?.avgFoil ?? price?.lowFoil ?? 0;
}

export function buildCollectionRow(
  entry: CollectionEntry,
  price?: CardmarketPriceSummary,
): CollectionRow {
  const displayPrinting = getCollectionDisplayPrinting(entry);
  const displayPrice = getDisplayPrice(price, "trend", displayPrinting);

  return {
    entry,
    price,
    displayPrice,
    estimatedValue:
      entry.normalQuantity * getNormalValue(price) +
      entry.foilQuantity * getFoilValue(price),
    totalQuantity: entry.normalQuantity + entry.foilQuantity,
  };
}

function compareSetNumber(a: CollectionRow, b: CollectionRow) {
  return (
    a.entry.card.setCode.localeCompare(b.entry.card.setCode) ||
    normalizeCollectorNumber(a.entry.card.number).localeCompare(
      normalizeCollectorNumber(b.entry.card.number),
    ) ||
    a.entry.card.name.localeCompare(b.entry.card.name)
  );
}

function getSortValue(row: CollectionRow, sortKey: CollectionSortKey) {
  switch (sortKey) {
    case "name":
      return row.entry.card.name;
    case "color":
      return row.entry.card.color;
    case "normal":
      return row.entry.normalQuantity;
    case "foil":
      return row.entry.foilQuantity;
    case "total":
      return row.totalQuantity;
    case "price":
      return row.displayPrice ?? -1;
    case "set":
    default:
      return "";
  }
}

export function sortCollectionRows(
  rows: CollectionRow[],
  sortKey: CollectionSortKey,
  direction: CollectionSortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortKey === "set") {
      return compareSetNumber(a, b) * multiplier;
    }

    const left = getSortValue(a, sortKey);
    const right = getSortValue(b, sortKey);

    if (typeof left === "number" && typeof right === "number") {
      const leftMissing = left < 0;
      const rightMissing = right < 0;

      if (leftMissing && !rightMissing) {
        return 1;
      }

      if (!leftMissing && rightMissing) {
        return -1;
      }

      return (left - right) * multiplier || compareSetNumber(a, b);
    }

    return (
      (String(left).localeCompare(String(right)) || compareSetNumber(a, b)) *
      multiplier
    );
  });
}
