import { CardScanInput, RiftboundCard } from '../cards/cards.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import { cardmarketCandidates } from './cardmarket-candidates.data';
import { CardmarketProductMapping } from './cardmarket.types';

export const cardmarketProducts = cardmarketCandidates;

function getProductKey(product: Pick<CardmarketProductMapping, 'setCode' | 'number'>) {
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

function hasPath(mapping: CardmarketProductMapping) {
  return mapping.cardmarketPath.trim().length > 0;
}

export function findCardmarketProductMapping(input: CardScanInput & Pick<RiftboundCard, 'name'>) {
  const targetSetCode = normalizeSetCode(input.setCode);
  const targetNumber = normalizeNumber(input.number);
  const targetName = normalizeText(input.name);

  const exactCollectorMatch = cardmarketProducts.find((mapping) => {
    return (
      hasPath(mapping) &&
      normalizeSetCode(mapping.setCode) === targetSetCode &&
      normalizeNumber(mapping.number) === targetNumber
    );
  });

  if (exactCollectorMatch) {
    return exactCollectorMatch;
  }

  const exactNameInSetMatches = cardmarketProducts.filter((mapping) => {
    return (
      hasPath(mapping) &&
      normalizeSetCode(mapping.setCode) === targetSetCode &&
      normalizeText(mapping.name) === targetName
    );
  });

  if (exactNameInSetMatches.length === 1) {
    return exactNameInSetMatches[0];
  }

  const exactNameMatches = cardmarketProducts.filter((mapping) => {
    return hasPath(mapping) && normalizeText(mapping.name) === targetName;
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
