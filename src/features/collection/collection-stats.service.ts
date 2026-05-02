import { getCardexCards } from '../cards/cards.service';
import { RiftboundCard } from '../cards/cards.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import { CollectionEntry } from './collection.types';

export type CollectionCompletionGroup = {
  key: string;
  label: string;
  owned: number;
  total: number;
  percent: number;
};

export type CollectionCompletionStats = {
  sets: CollectionCompletionGroup[];
  rarities: CollectionCompletionGroup[];
  colors: CollectionCompletionGroup[];
};

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase'];
const COLOR_ORDER = ['Fury', 'Body', 'Mind', 'Calm', 'Chaos', 'Order', 'Colorless'];

function normalizeValue(value?: string) {
  return (value ?? 'Unknown').trim() || 'Unknown';
}

function getPercent(owned: number, total: number) {
  return total > 0 ? (owned / total) * 100 : 0;
}

function getSetLabel(card: RiftboundCard) {
  return `${card.setCode} - ${card.set}`;
}

function getCardKey(card: Pick<RiftboundCard, 'setCode' | 'number'>) {
  return `${card.setCode.toUpperCase()}-${normalizeCollectorNumber(card.number)}`;
}

function buildGroups(
  cards: RiftboundCard[],
  ownedKeys: Set<string>,
  getKey: (card: RiftboundCard) => string,
  getLabel: (card: RiftboundCard) => string,
  order: string[] = [],
) {
  const groups = new Map<string, CollectionCompletionGroup>();

  cards.forEach((card) => {
    const key = getKey(card);
    const current = groups.get(key) ?? {
      key,
      label: getLabel(card),
      owned: 0,
      total: 0,
      percent: 0,
    };

    current.total += 1;

    if (ownedKeys.has(getCardKey(card))) {
      current.owned += 1;
    }

    groups.set(key, current);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      percent: getPercent(group.owned, group.total),
    }))
    .sort((left, right) => {
      const leftOrder = order.indexOf(left.key);
      const rightOrder = order.indexOf(right.key);
      const normalizedLeftOrder = leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder;
      const normalizedRightOrder = rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder;

      return normalizedLeftOrder - normalizedRightOrder || left.label.localeCompare(right.label);
    });
}

export function getCollectionCompletionStats(collection: CollectionEntry[]): CollectionCompletionStats {
  const catalogCards = getCardexCards();
  const ownedKeys = new Set(
    collection
      .filter((entry) => entry.normalQuantity + entry.foilQuantity > 0)
      .map((entry) => entry.cardKey),
  );

  return {
    sets: buildGroups(
      catalogCards,
      ownedKeys,
      (card) => card.setCode,
      getSetLabel,
    ),
    rarities: buildGroups(
      catalogCards,
      ownedKeys,
      (card) => normalizeValue(card.rarity),
      (card) => normalizeValue(card.rarity),
      RARITY_ORDER,
    ),
    colors: buildGroups(
      catalogCards,
      ownedKeys,
      (card) => normalizeValue(card.color),
      (card) => normalizeValue(card.color),
      COLOR_ORDER,
    ),
  };
}
