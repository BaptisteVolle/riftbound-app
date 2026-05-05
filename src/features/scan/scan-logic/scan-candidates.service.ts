import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import {
  findCardFromScan,
  getCardexCards,
  getLikelyCardCandidates,
} from "../../cards/cards.service";
import { normalizeCollectorNumber } from "../../riftcodex/riftcodex.service";
import {
  cardNameDoesNotConflict,
  getCoreVariantName,
  isSpecialVariant,
  normalizeRarity,
  normalizeScanText,
} from "./scan-text.service";

function getCardVariantKey(card: RiftboundCard) {
  return [
    card.setCode.toUpperCase(),
    normalizeCollectorNumber(card.number),
    normalizeScanText(card.name),
    normalizeRarity(card.rarity),
  ].join("-");
}

export function mergeCardCandidates(
  candidates: Array<RiftboundCard | undefined>,
) {
  const seenIds = new Set<string>();

  return candidates.filter((candidate): candidate is RiftboundCard => {
    if (!candidate || seenIds.has(candidate.id)) {
      return false;
    }

    seenIds.add(candidate.id);
    return true;
  });
}

function isSameVariantFamily(left: RiftboundCard, right: RiftboundCard) {
  const leftName = getCoreVariantName(left.name);
  const rightName = getCoreVariantName(right.name);

  if (!leftName || !rightName) {
    return false;
  }

  if (leftName === rightName) {
    return true;
  }

  const sameCollector =
    left.setCode.toUpperCase() === right.setCode.toUpperCase() &&
    normalizeCollectorNumber(left.number) ===
      normalizeCollectorNumber(right.number);

  return sameCollector;
}

function getVariantPriority(candidate: RiftboundCard, baseCard: RiftboundCard) {
  let priority = 0;

  if (normalizeScanText(candidate.name) === normalizeScanText(baseCard.name)) {
    priority += 40;
  }

  if (candidate.setCode.toUpperCase() === baseCard.setCode.toUpperCase()) {
    priority += 20;
  }

  if (
    normalizeCollectorNumber(candidate.number) ===
    normalizeCollectorNumber(baseCard.number)
  ) {
    priority += 15;
  }

  if (candidate.imageUrl) {
    priority += 10;
  }

  if (isSpecialVariant(candidate)) {
    priority -= 10;
  }

  return priority;
}

export function getVariantCandidates(
  baseCard: RiftboundCard,
  candidates: RiftboundCard[],
) {
  const catalogVariants = getCardexCards().filter((card) =>
    isSameVariantFamily(card, baseCard),
  );

  const filteredInputCandidates = candidates.filter((card) =>
    isSameVariantFamily(card, baseCard),
  );

  return mergeCardCandidates([
    baseCard,
    ...filteredInputCandidates,
    ...catalogVariants,
  ]).sort((left, right) => {
    return (
      getVariantPriority(right, baseCard) - getVariantPriority(left, baseCard)
    );
  });
}

export function getVisibleAlternativeCandidates(
  candidates: RiftboundCard[],
  selectedCard?: RiftboundCard,
) {
  const selectedKey = selectedCard ? getCardVariantKey(selectedCard) : "";
  const seenKeys = new Set<string>();

  return candidates.filter((candidate) => {
    const candidateKey = getCardVariantKey(candidate);

    if (selectedKey && candidateKey === selectedKey) {
      return false;
    }

    if (seenKeys.has(candidateKey)) {
      return false;
    }

    if (
      selectedCard &&
      !isSameVariantFamily(candidate, selectedCard) &&
      normalizeScanText(candidate.name) !== normalizeScanText(selectedCard.name)
    ) {
      return false;
    }

    seenKeys.add(candidateKey);
    return true;
  });
}

export function getScanCandidates(input: CardScanInput) {
  const directCard = findCardFromScan(input);
  const likelyCandidates = getLikelyCardCandidates(input, directCard, 12);

  const baseCards = mergeCardCandidates([directCard, ...likelyCandidates]);

  const variantCandidates = baseCards.flatMap((card) =>
    getVariantCandidates(card, baseCards),
  );

  return mergeCardCandidates([
    directCard,
    ...likelyCandidates,
    ...variantCandidates,
  ]).slice(0, 15);
}

export function getPreferredCandidate(candidates: RiftboundCard[]) {
  const exactNormalCandidate = candidates.find((candidate) => {
    return !isSpecialVariant(candidate);
  });

  if (exactNormalCandidate) {
    return exactNormalCandidate;
  }

  return candidates[0];
}
