import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import { normalizeCollectorNumber } from "../../riftcodex/riftcodex.service";
import { getStringSimilarity } from "../../../lib/string-similarity";

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

export function normalizeRarity(value?: string) {
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

export function hasAnyScanInput(input: CardScanInput) {
  return Boolean(
    input.name?.trim() || input.setCode?.trim() || input.number?.trim(),
  );
}

export function hasCollectorInput(input: CardScanInput) {
  return Boolean(input.setCode?.trim() && input.number?.trim());
}

export function getCoreVariantName(name: string) {
  return normalizeScanText(name)
    .replace(/\b(alternate art|overnumbered|signature|metal)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

export function isSpecialVariant(card: RiftboundCard) {
  return isFoilLockedCard(card);
}

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

export function isSureTextMatch(card: RiftboundCard, input: CardScanInput) {
  if (!hasCollectorInput(input)) {
    return false;
  }

  const collectorMatches = isExactScanMatch(card, input);
  const nameMatches = !input.name?.trim() || cardNameFitsInput(card, input);

  return collectorMatches && nameMatches;
}
