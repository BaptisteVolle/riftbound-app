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

  return cards.find((card) => {
    const nameMatches = normalizedName ? normalize(card.name).includes(normalizedName) : true;
    const setMatches = normalizedSetCode ? card.setCode === normalizedSetCode : true;
    const numberMatches = input.number ? card.number === input.number : true;
    return nameMatches && setMatches && numberMatches;
  });
}

export function buildCardmarketUrl(card: RiftboundCard) {
  if (card.cardmarketPath) {
    return `${CARDMARKET_BASE_URL}${card.cardmarketPath}`;
  }

  return `${CARDMARKET_BASE_URL}/en/Riftbound/Cards/${slugifyCardmarketName(card.name)}`;
}
