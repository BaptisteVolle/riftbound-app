import { getDisplayPrice } from '../cardmarket/cardmarket-prices.service';
import { CardmarketPriceSummary } from '../cardmarket/cardmarket.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import { CollectionEntry, CollectionRow } from './collection.types';

export type CollectionSortKey =
  | 'set'
  | 'name'
  | 'color'
  | 'normal'
  | 'foil'
  | 'total'
  | 'low'
  | 'avg'
  | 'trend'
  | 'value';

export type CollectionSortDirection = 'asc' | 'desc';
export type CollectionPrintingFilter = 'all' | 'normal' | 'foil';

export const COLLECTION_SORT_OPTIONS: CollectionSortKey[] = [
  'set',
  'name',
  'color',
  'normal',
  'foil',
  'total',
  'low',
  'avg',
  'trend',
  'value',
];

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
  const displayPrinting = entry.foilQuantity > 0 && entry.normalQuantity === 0 ? 'foil' : 'normal';

  return {
    entry,
    price,
    low: getDisplayPrice(price, 'low', displayPrinting),
    avg: getDisplayPrice(price, 'avg', displayPrinting),
    trend: getDisplayPrice(price, 'trend', displayPrinting),
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
    case 'name':
      return row.entry.card.name;
    case 'color':
      return row.entry.card.color;
    case 'normal':
      return row.entry.normalQuantity;
    case 'foil':
      return row.entry.foilQuantity;
    case 'total':
      return row.totalQuantity;
    case 'low':
      return row.low ?? -1;
    case 'avg':
      return row.avg ?? -1;
    case 'trend':
      return row.trend ?? -1;
    case 'value':
      return row.estimatedValue;
    case 'set':
    default:
      return '';
  }
}

export function sortCollectionRows(
  rows: CollectionRow[],
  sortKey: CollectionSortKey,
  direction: CollectionSortDirection,
) {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortKey === 'set') {
      return compareSetNumber(a, b) * multiplier;
    }

    const left = getSortValue(a, sortKey);
    const right = getSortValue(b, sortKey);

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right || compareSetNumber(a, b)) * multiplier;
    }

    return (String(left).localeCompare(String(right)) || compareSetNumber(a, b)) * multiplier;
  });
}
