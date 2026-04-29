import { CardScanInput, RiftboundCard } from '../cards/cards.types';
import {
  findCardFromScan,
  getLikelyCardCandidates,
} from '../cards/cards.service';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import { findBestImageMatch } from './image-recognition.service';
import type { ImageMatchResult } from './image-recognition.service';
import type { RarityHint } from './ocr.service';

export type ScanCardDecision = {
  card: RiftboundCard;
  reason: string;
  isValidated: boolean;
};

export function getManualScanInput(
  name: string,
  setCode: string,
  number: string,
): CardScanInput {
  return {
    name: name.trim(),
    setCode: setCode.trim().toUpperCase(),
    number: number.trim(),
  };
}

export function normalizeScanText(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+\((alternate art|overnumbered|signature|metal)\)$/i, '')
    .replace(/\s+(alternate art|overnumbered|signature|metal)$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\brek sai\b/g, 'reksai')
    .trim();
}

function getTextTokens(value: string) {
  return normalizeScanText(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

export function cardNameFitsInput(card: RiftboundCard, input: CardScanInput) {
  const targetName = normalizeScanText(input.name);
  const cardName = normalizeScanText(card.name);

  if (!targetName) {
    return false;
  }

  if (cardName.includes(targetName) || targetName.includes(cardName)) {
    return true;
  }

  const cardTokens = new Set(getTextTokens(card.name));
  const overlapCount = getTextTokens(input.name ?? '').filter((token) =>
    cardTokens.has(token),
  ).length;

  return overlapCount >= 2;
}

export function cardNameDoesNotConflict(card: RiftboundCard, input: CardScanInput) {
  return !input.name?.trim() || cardNameFitsInput(card, input);
}

export function isFoilLockedCard(card?: RiftboundCard) {
  if (!card) {
    return false;
  }

  return Boolean(
    card.alternateArt ||
      card.overnumbered ||
      card.signature ||
      card.rarity?.toLowerCase() === 'showcase' ||
      /\b(alternate art|overnumbered|signature|metal)\b/i.test(card.name),
  );
}

function normalizeRarity(value?: string) {
  return normalizeScanText(value);
}

export function isExactScanMatch(card: RiftboundCard, scanInput: CardScanInput) {
  const inputSetCode = scanInput.setCode?.trim().toUpperCase();
  const inputNumber = scanInput.number
    ? normalizeCollectorNumber(scanInput.number)
    : '';

  if (!inputSetCode || !inputNumber) {
    return false;
  }

  return (
    card.setCode === inputSetCode &&
    normalizeCollectorNumber(card.number) === inputNumber
  );
}

function getCardVariantKey(card: RiftboundCard) {
  return [
    card.setCode.toUpperCase(),
    normalizeCollectorNumber(card.number),
    normalizeScanText(card.name),
    normalizeRarity(card.rarity),
  ].join('-');
}

export function getVisibleAlternativeCandidates(
  candidates: RiftboundCard[],
  selectedCard?: RiftboundCard,
) {
  const selectedKey = selectedCard ? getCardVariantKey(selectedCard) : '';
  const seenKeys = new Set<string>();

  return candidates.filter((candidate) => {
    const candidateKey = getCardVariantKey(candidate);

    if (selectedKey && candidateKey === selectedKey) {
      return false;
    }

    if (seenKeys.has(candidateKey)) {
      return false;
    }

    seenKeys.add(candidateKey);
    return true;
  });
}

function mergeCardCandidates(candidates: Array<RiftboundCard | undefined>) {
  const seenIds = new Set<string>();

  return candidates.filter((candidate): candidate is RiftboundCard => {
    if (!candidate || seenIds.has(candidate.id)) {
      return false;
    }

    seenIds.add(candidate.id);
    return true;
  });
}

function getOcrCollectorCandidates(input: CardScanInput) {
  const set = input.setCode?.trim().toUpperCase();
  const number = input.number ? normalizeCollectorNumber(input.number) : '';

  if (set !== 'OPP' || !number) {
    return [];
  }

  const [, digits = number, suffix = ''] =
    number.match(/^(\d{1,3})([A-Z]?)$/) ?? [];
  const isAlternateName = /\balternate\b|\bart\b/i.test(input.name ?? '');
  const candidateNumbers =
    suffix === 'B'
      ? [`${digits}A`, digits]
      : [isAlternateName ? `${digits}A` : digits, `${digits}A`, digits];

  return [...new Set(candidateNumbers)].map((candidateNumber) => ({
    ...input,
    setCode: 'OGN',
    number: suffix === '*' ? number : candidateNumber,
  }));
}

export function hasAnyScanInput(input: CardScanInput) {
  return Boolean(input.name?.trim() || input.setCode?.trim() || input.number?.trim());
}

function hasCollectorInput(input: CardScanInput) {
  return Boolean(input.setCode?.trim() && input.number?.trim());
}

export function isSureTextMatch(card: RiftboundCard, input: CardScanInput) {
  if (!hasCollectorInput(input)) {
    return false;
  }

  const collectorMatches = isExactScanMatch(card, input);
  const nameMatches = !input.name?.trim() || cardNameFitsInput(card, input);

  return collectorMatches && nameMatches;
}

export function getCollectorMatch(input: CardScanInput, photoUri?: string) {
  if (!hasCollectorInput(input)) {
    return undefined;
  }

  const directMatch = {
    card: findCardFromScan({
      setCode: input.setCode,
      number: input.number,
      name: input.name,
    }),
    input,
  };

  if (
    directMatch.card &&
    (!photoUri || cardNameDoesNotConflict(directMatch.card, input))
  ) {
    return directMatch;
  }

  return getOcrCollectorCandidates(input)
    .map((candidateInput) => ({
      card: findCardFromScan(candidateInput),
      input: candidateInput,
    }))
    .find((candidate) => {
      return Boolean(
        candidate.card && cardNameDoesNotConflict(candidate.card, input),
      );
    });
}

function pickImageMatchedCandidate(
  imageMatch: ImageMatchResult | undefined,
  input: CardScanInput,
) {
  if (!imageMatch || imageMatch.similarity < 0.58 || imageMatch.margin < 0.015) {
    return undefined;
  }

  if (!cardNameDoesNotConflict(imageMatch.card, input)) {
    return undefined;
  }

  return imageMatch.card;
}

function pickRarityMatchedCandidate(
  candidates: RiftboundCard[],
  input: CardScanInput,
  seedCard?: RiftboundCard,
  rarityHint?: RarityHint,
) {
  if (!rarityHint || rarityHint.confidence < 0.16) {
    return undefined;
  }

  const hintRarity = normalizeRarity(rarityHint.rarity);
  const seedSetCode = seedCard?.setCode.toUpperCase();
  const seedNumber = seedCard ? normalizeCollectorNumber(seedCard.number) : '';
  const seedName = seedCard ? normalizeScanText(seedCard.name) : '';

  return candidates.find((candidate) => {
    const isRelatedVariant =
      !seedCard ||
      (candidate.setCode.toUpperCase() === seedSetCode &&
        normalizeCollectorNumber(candidate.number) === seedNumber) ||
      normalizeScanText(candidate.name) === seedName;

    return (
      isRelatedVariant &&
      cardNameDoesNotConflict(candidate, input) &&
      normalizeRarity(candidate.rarity) === hintRarity
    );
  });
}

export async function chooseValidatedCard({
  baseCard,
  candidates,
  input,
  photoUri,
  rarityHint,
}: {
  baseCard: RiftboundCard;
  candidates: RiftboundCard[];
  input: CardScanInput;
  photoUri?: string;
  rarityHint?: RarityHint;
}): Promise<ScanCardDecision> {
  if (isSureTextMatch(baseCard, input)) {
    return {
      card: baseCard,
      isValidated: true,
      reason: 'Text match',
    };
  }

  const imageMatch = photoUri
    ? await findBestImageMatch(photoUri, candidates)
    : undefined;
  const imageMatchedCard = pickImageMatchedCandidate(imageMatch, input);

  if (imageMatchedCard) {
    return {
      card: imageMatchedCard,
      isValidated: true,
      reason: `Image match ${Math.round((imageMatch?.similarity ?? 0) * 100)}%`,
    };
  }

  const rarityMatchedCard = pickRarityMatchedCandidate(
    candidates,
    input,
    baseCard,
    rarityHint,
  );

  if (rarityMatchedCard) {
    return {
      card: rarityMatchedCard,
      isValidated: false,
      reason: `Rarity hint ${rarityHint?.rarity}`,
    };
  }

  return {
    card: baseCard,
    isValidated: false,
    reason: 'Best text match',
  };
}

export function getStableScanCandidates(input: CardScanInput, seedCard?: RiftboundCard) {
  const ocrCollectorCandidates = getOcrCollectorCandidates(input)
    .map((candidateInput) => findCardFromScan(candidateInput))
    .filter((card) => {
      return card ? cardNameDoesNotConflict(card, input) : false;
    });

  return mergeCardCandidates([
    seedCard,
    ...ocrCollectorCandidates,
    ...getLikelyCardCandidates(input, seedCard),
  ]);
}
