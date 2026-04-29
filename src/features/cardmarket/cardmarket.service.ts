import { CardScanInput, RiftboundCard } from '../cards/cards.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import { cardmarketCandidates } from './cardmarket-candidates.data';
import { cardmarketOverrides } from './cardmarket-overrides.data';
import { CardmarketOverride } from './cardmarket.types';

export const cardmarketProducts = [...cardmarketOverrides, ...cardmarketCandidates];

function getProductKey(product: Pick<CardmarketOverride, 'setCode' | 'number'>) {
  return `${product.setCode.toUpperCase()}-${normalizeNumber(product.number)}`;
}

const candidateImagesByCollector = new Map(
  cardmarketCandidates
    .filter((candidate) => candidate.imageUrl)
    .map((candidate) => [getProductKey(candidate), candidate.imageUrl]),
);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeSetCode(value?: string) {
  return value?.trim().toUpperCase() ?? '';
}

function normalizeNumber(value?: string) {
  return value ? normalizeCollectorNumber(value) : '';
}

function hasPath(override: CardmarketOverride) {
  return override.cardmarketPath.trim().length > 0;
}

export function findCardmarketOverride(input: CardScanInput & Pick<RiftboundCard, 'name'>) {
  const targetSetCode = normalizeSetCode(input.setCode);
  const targetNumber = normalizeNumber(input.number);
  const targetName = normalizeText(input.name);

  const exactCollectorMatch = cardmarketProducts.find((override) => {
    return (
      hasPath(override) &&
      normalizeSetCode(override.setCode) === targetSetCode &&
      normalizeNumber(override.number) === targetNumber
    );
  });

  if (exactCollectorMatch) {
    return exactCollectorMatch;
  }

  const exactNameInSetMatches = cardmarketProducts.filter((override) => {
    return (
      hasPath(override) &&
      normalizeSetCode(override.setCode) === targetSetCode &&
      normalizeText(override.name) === targetName
    );
  });

  if (exactNameInSetMatches.length === 1) {
    return exactNameInSetMatches[0];
  }

  const exactNameMatches = cardmarketProducts.filter((override) => {
    return hasPath(override) && normalizeText(override.name) === targetName;
  });

  if (exactNameMatches.length === 1) {
    return exactNameMatches[0];
  }

  return undefined;
}

export function getCardmarketProducts() {
  return cardmarketProducts.map((product) => ({
    ...product,
    imageUrl: product.imageUrl ?? candidateImagesByCollector.get(getProductKey(product)),
  }));
}
