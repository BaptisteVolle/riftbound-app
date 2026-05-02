import { Directory, File, Paths } from 'expo-file-system';

import { getAllCards } from '../cards/cards.service';
import { RiftboundCard } from '../cards/cards.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import {
  CollectionCardSnapshot,
  CollectionEntry,
  CollectionPrinting,
  CollectionTotals,
} from './collection.types';

const STORAGE_DIRECTORY = new Directory(Paths.document, 'riftbound-app');
const COLLECTION_FILE = new File(STORAGE_DIRECTORY, 'collection.json');
let catalogByCollectionKey: Map<string, RiftboundCard> | undefined;

function getNow() {
  return new Date().toISOString();
}

function ensureCollectionFile() {
  STORAGE_DIRECTORY.create({ intermediates: true, idempotent: true });

  if (!COLLECTION_FILE.exists) {
    COLLECTION_FILE.create({ intermediates: true });
    COLLECTION_FILE.write('[]');
  }
}

function sortCollection(collection: CollectionEntry[]) {
  return [...collection].sort((a, b) => {
    return (
      a.card.setCode.localeCompare(b.card.setCode) ||
      normalizeCollectorNumber(a.card.number).localeCompare(normalizeCollectorNumber(b.card.number)) ||
      a.card.name.localeCompare(b.card.name)
    );
  });
}

function getCatalogByCollectionKey() {
  if (!catalogByCollectionKey) {
    catalogByCollectionKey = new Map(
      getAllCards().map((card) => [getCollectionCardKey(card), card]),
    );
  }

  return catalogByCollectionKey;
}

function hydrateCollectionEntry(entry: CollectionEntry): CollectionEntry {
  const catalogCard = getCatalogByCollectionKey().get(entry.cardKey);

  if (!catalogCard) {
    return entry;
  }

  return {
    ...entry,
    card: {
      ...entry.card,
      ...toCollectionCardSnapshot(catalogCard),
    },
  };
}

function sanitizeQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

export function getCollectionCardKey(card: Pick<RiftboundCard, 'setCode' | 'number'>) {
  return `${card.setCode.toUpperCase()}-${normalizeCollectorNumber(card.number)}`;
}

export function toCollectionCardSnapshot(card: RiftboundCard): CollectionCardSnapshot {
  return {
    id: card.id,
    externalId: card.externalId,
    name: card.name,
    set: card.set,
    setCode: card.setCode,
    number: normalizeCollectorNumber(card.number),
    color: card.color,
    cost: card.cost,
    type: card.type,
    imageUrl: card.imageUrl,
    rarity: card.rarity,
    alternateArt: card.alternateArt,
    overnumbered: card.overnumbered,
    signature: card.signature,
  };
}

async function readCollectionFile() {
  ensureCollectionFile();
  const text = await COLLECTION_FILE.text();

  if (!text.trim()) {
    return [];
  }

  try {
    return JSON.parse(text) as CollectionEntry[];
  } catch {
    return [];
  }
}

function writeCollectionFile(collection: CollectionEntry[]) {
  ensureCollectionFile();
  COLLECTION_FILE.write(JSON.stringify(sortCollection(collection), null, 2));
}

export async function getCollection() {
  return sortCollection((await readCollectionFile()).map(hydrateCollectionEntry));
}

export async function addCardToCollection(
  card: RiftboundCard,
  printing: CollectionPrinting = 'normal',
  amount = 1,
) {
  const collection = await readCollectionFile();
  const cardKey = getCollectionCardKey(card);
  const existingEntry = collection.find((entry) => entry.cardKey === cardKey);
  const quantity = sanitizeQuantity(amount);
  const now = getNow();

  if (existingEntry) {
    if (printing === 'foil') {
      existingEntry.foilQuantity += quantity;
    } else {
      existingEntry.normalQuantity += quantity;
    }

    existingEntry.card = toCollectionCardSnapshot(card);
    existingEntry.updatedAt = now;
    writeCollectionFile(collection);
    return existingEntry;
  }

  const entry: CollectionEntry = {
    cardKey,
    card: toCollectionCardSnapshot(card),
    normalQuantity: printing === 'normal' ? quantity : 0,
    foilQuantity: printing === 'foil' ? quantity : 0,
    language: 'EN',
    condition: 'NM',
    createdAt: now,
    updatedAt: now,
  };

  collection.push(entry);
  writeCollectionFile(collection);
  return entry;
}

export async function removeCardFromCollection(
  cardKey: string,
  printing: CollectionPrinting = 'normal',
  amount = 1,
) {
  const collection = await readCollectionFile();
  const entry = collection.find((item) => item.cardKey === cardKey);

  if (!entry) {
    return undefined;
  }

  const quantity = sanitizeQuantity(amount);

  if (printing === 'foil') {
    entry.foilQuantity = Math.max(0, entry.foilQuantity - quantity);
  } else {
    entry.normalQuantity = Math.max(0, entry.normalQuantity - quantity);
  }

  entry.updatedAt = getNow();
  const nextCollection = collection.filter((item) => {
    return item.normalQuantity + item.foilQuantity > 0;
  });

  writeCollectionFile(nextCollection);
  return entry;
}

export function getCollectionTotals(collection: CollectionEntry[]): CollectionTotals {
  return collection.reduce(
    (totals, entry) => {
      totals.uniqueCards += 1;
      totals.normalCards += entry.normalQuantity;
      totals.foilCards += entry.foilQuantity;
      totals.totalCards += entry.normalQuantity + entry.foilQuantity;
      return totals;
    },
    {
      uniqueCards: 0,
      totalCards: 0,
      normalCards: 0,
      foilCards: 0,
    },
  );
}
