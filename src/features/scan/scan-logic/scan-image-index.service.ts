import { getCardById } from "../../cards/cards.service";
import type { RiftboundCard } from "../../cards/cards.types";
import { SCAN_IMAGE_DEBUG } from "../debug/scan-debug-flag";
import {
  CARD_IMAGE_INDEX,
  CARD_IMAGE_SIGNATURE_VERSION,
} from "../generated/card-image-index";
import type { CardImageIndexEntry } from "./scan-image-signature.types";

export type IndexedCardImageEntry = {
  card: RiftboundCard;
  entry: CardImageIndexEntry;
};

export type CardImageIndexStats = {
  totalEntries: number;
  supportedEntries: number;
  indexedCards: number;
  orphanEntries: number;
  unsupportedEntries: number;
};

let indexedEntriesCache: IndexedCardImageEntry[] | undefined;
let indexStatsCache: CardImageIndexStats | undefined;

function isSupportedIndexEntry(
  entry: CardImageIndexEntry,
): entry is CardImageIndexEntry & { signatureVersion: 1 } {
  return entry.signatureVersion === CARD_IMAGE_SIGNATURE_VERSION;
}

function buildIndexedEntries() {
  const supportedEntries = CARD_IMAGE_INDEX.filter(isSupportedIndexEntry);
  const indexedEntries: IndexedCardImageEntry[] = [];
  const orphanEntries: CardImageIndexEntry[] = [];

  for (const entry of supportedEntries) {
    const card = getCardById(entry.cardId);

    if (!card) {
      orphanEntries.push(entry);
      continue;
    }

    indexedEntries.push({
      card,
      entry,
    });
  }

  indexStatsCache = {
    totalEntries: CARD_IMAGE_INDEX.length,
    supportedEntries: supportedEntries.length,
    indexedCards: indexedEntries.length,
    orphanEntries: orphanEntries.length,
    unsupportedEntries: CARD_IMAGE_INDEX.length - supportedEntries.length,
  };

  if (SCAN_IMAGE_DEBUG) {
    console.log("[IMAGE INDEX] loaded local image index:", indexStatsCache);

    if (orphanEntries.length > 0) {
      console.log(
        "[IMAGE INDEX] orphan entries:",
        orphanEntries.slice(0, 20).map((entry) => ({
          cardId: entry.cardId,
          name: entry.name,
          setCode: entry.setCode,
          number: entry.number,
        })),
      );
    }
  }

  return indexedEntries;
}

export function getCardImageIndexEntries() {
  return CARD_IMAGE_INDEX.filter(isSupportedIndexEntry);
}

export function getIndexedCardImageEntries() {
  if (!indexedEntriesCache) {
    indexedEntriesCache = buildIndexedEntries();
  }

  return indexedEntriesCache;
}

export function getIndexedCards() {
  return getIndexedCardImageEntries().map(({ card }) => card);
}

export function getCardImageIndexStats() {
  if (!indexStatsCache) {
    getIndexedCardImageEntries();
  }

  return indexStatsCache!;
}
