import type { CardmarketPriceSummary } from "../cardmarket/cardmarket.types";
import type { RiftboundCard } from "../cards/cards.types";
import { getCollectionCardKey } from "../collection/collection.service";
import { normalizeCollectorNumber } from "../riftcodex/riftcodex.service";
import { getCardexSortPrice } from "./cardex-price.service";
import type { CardexSortDirection, CardexSortKey } from "./cardex.types";

export function compareCardexSetNumber(a: RiftboundCard, b: RiftboundCard) {
  return (
    a.setCode.localeCompare(b.setCode) ||
    normalizeCollectorNumber(a.number).localeCompare(
      normalizeCollectorNumber(b.number),
      undefined,
      { numeric: true },
    ) ||
    a.name.localeCompare(b.name)
  );
}

export function sortCardexCards({
  cards,
  pricesByKey,
  sortDirection,
  sortKey,
}: {
  cards: RiftboundCard[];
  pricesByKey: Record<string, CardmarketPriceSummary | undefined>;
  sortDirection: CardexSortDirection;
  sortKey: CardexSortKey;
}) {
  const multiplier = sortDirection === "asc" ? 1 : -1;

  return [...cards].sort((a, b) => {
    if (sortKey === "price") {
      const priceA = getCardexSortPrice(pricesByKey[getCollectionCardKey(a)]);
      const priceB = getCardexSortPrice(pricesByKey[getCollectionCardKey(b)]);

      const aMissing = priceA === undefined;
      const bMissing = priceB === undefined;

      if (aMissing && !bMissing) {
        return 1;
      }

      if (!aMissing && bMissing) {
        return -1;
      }

      if (aMissing && bMissing) {
        return compareCardexSetNumber(a, b);
      }

      return (
        ((priceA ?? 0) - (priceB ?? 0)) * multiplier ||
        compareCardexSetNumber(a, b)
      );
    }

    if (sortKey === "name") {
      return (
        (a.name.localeCompare(b.name) || compareCardexSetNumber(a, b)) *
        multiplier
      );
    }

    if (sortKey === "type") {
      return (
        (a.type.localeCompare(b.type) || compareCardexSetNumber(a, b)) *
        multiplier
      );
    }

    if (sortKey === "rarity") {
      return (
        ((a.rarity ?? "").localeCompare(b.rarity ?? "") ||
          compareCardexSetNumber(a, b)) * multiplier
      );
    }

    return compareCardexSetNumber(a, b) * multiplier;
  });
}
