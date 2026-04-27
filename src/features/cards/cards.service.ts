import { cards } from './cards.data';
import { CardScanInput, RiftboundCard } from './cards.types';

const CARDMARKET_BASE_URL = 'https://www.cardmarket.com';

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugifyCardmarketName(name: string) {
  return name
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getAllCards() {
  return cards;
}

export function getCardById(id: string) {
  return cards.find((card) => card.id === id);
}

export function searchCards(query: string) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return cards;
  }

  return cards.filter((card) => {
    const haystack = normalize(
      `${card.name} ${card.set} ${card.setCode} ${card.number} ${card.color} ${card.type}`,
    );
    return haystack.includes(normalizedQuery);
  });
}

export function findCardFromScan(input: CardScanInput): RiftboundCard | undefined {
  const normalizedName = input.name ? normalize(input.name) : '';
  const normalizedSetCode = input.setCode?.toUpperCase();
  const normalizedNumber = input.number?.padStart(3, '0');

  if (normalizedSetCode && normalizedNumber) {
    const exactCollectorMatch = cards.find(
      (card) => card.setCode === normalizedSetCode && card.number === normalizedNumber,
    );

    if (exactCollectorMatch) {
      return exactCollectorMatch;
    }
  }

  return cards.find((card) => {
    const nameMatches = normalizedName ? normalize(card.name).includes(normalizedName) : true;
    const setMatches = normalizedSetCode ? card.setCode === normalizedSetCode : true;
    const numberMatches = normalizedNumber ? card.number === normalizedNumber : true;
    return nameMatches && setMatches && numberMatches;
  });
}

export function buildCardmarketUrl(card: RiftboundCard) {
  if (card.cardmarketPath) {
    return `${CARDMARKET_BASE_URL}${card.cardmarketPath}`;
  }

  return `${CARDMARKET_BASE_URL}/en/Riftbound/Cards/${slugifyCardmarketName(card.name)}`;
}

export function buildCardmarketSearchUrl(input: CardScanInput) {
  const searchQuery = input.name?.trim();

  if (!searchQuery) {
    return undefined;
  }

  return `${CARDMARKET_BASE_URL}/en/Riftbound/Products/Search?searchString=${encodeURIComponent(
    searchQuery,
  )}`;
}

export function buildCardmarketUrlForCard(card: RiftboundCard) {
  const shouldUseVariantSlug =
    Boolean(card.cardmarketPath) &&
    (card.overnumbered ||
      card.signature ||
      card.alternateArt ||
      ['Rare', 'Epic', 'Showcase'].includes(card.rarity ?? ''));

  if (shouldUseVariantSlug) {
    return buildCardmarketUrl(card);
  }

  return buildCardmarketSearchUrl({ name: card.name }) ?? buildCardmarketUrl(card);
}
