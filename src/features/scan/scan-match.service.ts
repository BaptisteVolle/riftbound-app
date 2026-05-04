import { CardScanInput, RiftboundCard } from "../cards/cards.types";
import {
  findCardFromScan,
  getCardexCards,
  getLikelyCardCandidates,
} from "../cards/cards.service";
import { normalizeCollectorNumber } from "../riftcodex/riftcodex.service";
import { findBestImageMatch } from "./image-recognition.service";
import type { ImageMatchResult } from "./image-recognition.service";
import type { RarityHint } from "./ocr.service";
import { getStringSimilarity } from "../../lib/string-similarity";

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
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+\((alternate art|overnumbered|signature|metal)\)$/i, "")
    .replace(/\s+(alternate art|overnumbered|signature|metal)$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\brek sai\b/g, "reksai")
    .trim();
}

function getTextTokens(value: string) {
  return normalizeScanText(value)
    .split(" ")
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

  const similarity = getStringSimilarity(cardName, targetName);
  const shortNameThreshold =
    Math.max(cardName.length, targetName.length) <= 6 ? 0.66 : 0.76;

  if (similarity >= shortNameThreshold) {
    return true;
  }

  const cardTokens = new Set(getTextTokens(card.name));
  const overlapCount = getTextTokens(input.name ?? "").filter((token) =>
    cardTokens.has(token),
  ).length;

  return overlapCount >= 2;
}

export function cardNameDoesNotConflict(
  card: RiftboundCard,
  input: CardScanInput,
) {
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
    card.rarity?.toLowerCase() === "showcase" ||
    /\b(alternate art|overnumbered|signature|metal)\b/i.test(card.name),
  );
}

function normalizeRarity(value?: string) {
  return normalizeScanText(value);
}

export function isExactScanMatch(
  card: RiftboundCard,
  scanInput: CardScanInput,
) {
  const inputSetCode = scanInput.setCode?.trim().toUpperCase();
  const inputNumber = scanInput.number
    ? normalizeCollectorNumber(scanInput.number)
    : "";

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
  ].join("-");
}

const NAME_RELATION_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function getNameRelationTokens(name: string) {
  return normalizeScanText(name)
    .split(" ")
    .filter(
      (token) => token.length >= 3 && !NAME_RELATION_STOP_WORDS.has(token),
    );
}

function areCardNamesRelated(leftName: string, rightName: string) {
  const left = normalizeScanText(leftName);
  const right = normalizeScanText(rightName);

  if (!left || !right) {
    return false;
  }

  if (left === right || left.includes(right) || right.includes(left)) {
    return true;
  }

  const leftTokens = new Set(getNameRelationTokens(leftName));

  return getNameRelationTokens(rightName).some((token) =>
    leftTokens.has(token),
  );
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
      !areCardNamesRelated(candidate.name, selectedCard.name)
    ) {
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

  if (isFoilLockedCard(candidate)) {
    priority += 3;
  }

  return priority;
}

function getCoreVariantName(name: string) {
  return normalizeScanText(name)
    .replace(/\b(alternate art|overnumbered|signature|metal)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function getOcrCollectorCandidates(input: CardScanInput) {
  const set = input.setCode?.trim().toUpperCase();
  const number = input.number ? normalizeCollectorNumber(input.number) : "";

  if (set !== "OPP" || !number) {
    return [];
  }

  const [, digits = number, suffix = ""] =
    number.match(/^(\d{1,3})([A-Z]?)$/) ?? [];
  const isAlternateName = /\balternate\b|\bart\b/i.test(input.name ?? "");
  const candidateNumbers =
    suffix === "B"
      ? [`${digits}A`, digits]
      : [isAlternateName ? `${digits}A` : digits, `${digits}A`, digits];

  return [...new Set(candidateNumbers)].map((candidateNumber) => ({
    ...input,
    setCode: "OGN",
    number: suffix === "*" ? number : candidateNumber,
  }));
}

export function hasAnyScanInput(input: CardScanInput) {
  return Boolean(
    input.name?.trim() || input.setCode?.trim() || input.number?.trim(),
  );
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
  options?: {
    variantMode?: boolean;
  },
) {
  if (!imageMatch) {
    return undefined;
  }

  const minSimilarity = options?.variantMode ? 0.68 : 0.58;
  const minMargin = options?.variantMode ? 0.0035 : 0.015;

  if (imageMatch.similarity < minSimilarity || imageMatch.margin < minMargin) {
    if (__DEV__) {
      console.log("[IMAGE] rejected match:", {
        name: imageMatch.card.name,
        setCode: imageMatch.card.setCode,
        number: imageMatch.card.number,
        similarity: imageMatch.similarity,
        margin: imageMatch.margin,
        minSimilarity,
        minMargin,
      });
    }

    return undefined;
  }

  if (!cardNameDoesNotConflict(imageMatch.card, input)) {
    if (__DEV__) {
      console.log("[IMAGE] rejected because name conflicts:", {
        imageCard: imageMatch.card.name,
        inputName: input.name,
      });
    }

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
  const seedNumber = seedCard ? normalizeCollectorNumber(seedCard.number) : "";
  const seedName = seedCard ? normalizeScanText(seedCard.name) : "";

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
      reason: "Text match",
    };
  }

  const variantCandidates = getVariantCandidates(baseCard, candidates);

  if (__DEV__) {
    console.log(
      "[SCAN] variant candidates:",
      variantCandidates.map((card) => ({
        name: card.name,
        setCode: card.setCode,
        number: card.number,
        imageUrl: Boolean(card.imageUrl),
      })),
    );
  }

  const imageMatch = photoUri
    ? await findBestImageMatch(photoUri, variantCandidates)
    : undefined;

  const imageMatchedCard = pickImageMatchedCandidate(imageMatch, input, {
    variantMode: true,
  });

  if (imageMatchedCard) {
    return {
      card: imageMatchedCard,
      isValidated: true,
      reason: `Image match ${imageMatch?.similarity.toFixed(3)} / margin ${imageMatch?.margin.toFixed(3)}`,
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
    reason: "Best text match",
  };
}

export function getStableScanCandidates(
  input: CardScanInput,
  seedCard?: RiftboundCard,
) {
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

function isSpecialVariant(card: RiftboundCard) {
  return Boolean(
    card.alternateArt ||
    card.overnumbered ||
    card.signature ||
    /\b(alternate art|overnumbered|signature|metal)\b/i.test(card.name) ||
    card.rarity?.toLowerCase() === "showcase",
  );
}

function getPreferredTextFallbackCard(
  baseCard: RiftboundCard,
  variantCandidates: RiftboundCard[],
) {
  const sameFamilyCandidates = variantCandidates.filter((candidate) =>
    isSameVariantFamily(candidate, baseCard),
  );

  const normalSameSet = sameFamilyCandidates.find((candidate) => {
    return (
      candidate.setCode.toUpperCase() === baseCard.setCode.toUpperCase() &&
      !isSpecialVariant(candidate)
    );
  });

  if (normalSameSet) {
    return normalSameSet;
  }

  const normalAnySet = sameFamilyCandidates.find((candidate) => {
    return !isSpecialVariant(candidate);
  });

  if (normalAnySet) {
    return normalAnySet;
  }

  return baseCard;
}
