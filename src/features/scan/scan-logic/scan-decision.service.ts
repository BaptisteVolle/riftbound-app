import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import { normalizeCollectorNumber } from "../../riftcodex/riftcodex.service";
import type {
  ImageMatchResult,
  ScanDecisionInput,
} from "./scan-image-signature.types";
import {
  cardNameDoesNotConflict,
  isExactScanMatch,
  normalizeRarity,
} from "./scan-text.service";
import type { ScanAnalysisResult } from "../scan.types";
import { getPreferredCandidate } from "./scan-candidates.service";

const STRONG_IMAGE_SCORE = 0.8;
const STRONG_IMAGE_MARGIN = 0.03;
const WEAK_IMAGE_MARGIN = 0.012;

type LegacyScanDecisionInput = {
  input: CardScanInput;
  candidates: RiftboundCard[];
  imageMatch?: ImageMatchResult;
};

function isStrongImageMatch(imageMatch?: ImageMatchResult) {
  return Boolean(
    imageMatch &&
    imageMatch.score >= STRONG_IMAGE_SCORE &&
    imageMatch.margin >= STRONG_IMAGE_MARGIN,
  );
}

function hasWeakImageMargin(imageMatch?: ImageMatchResult) {
  return Boolean(imageMatch && imageMatch.margin < WEAK_IMAGE_MARGIN);
}

function getDecisionInput(
  input: ScanDecisionInput | LegacyScanDecisionInput,
): ScanDecisionInput {
  if ("imageMatches" in input) {
    return input;
  }

  return {
    imageMatches: input.imageMatch ? [input.imageMatch] : [],
    ocrInput: input.input,
    candidates: input.candidates,
    mode: "text-fallback",
  };
}

function getCardTextContradiction(card: RiftboundCard, input: CardScanInput) {
  const inputSetCode = input.setCode?.trim().toUpperCase();
  const inputNumber = input.number
    ? normalizeCollectorNumber(input.number)
    : "";

  if (inputSetCode && card.setCode !== inputSetCode) {
    return "set";
  }

  if (
    inputSetCode &&
    inputNumber &&
    normalizeCollectorNumber(card.number) !== inputNumber
  ) {
    return "collector";
  }

  if (
    !inputSetCode &&
    inputNumber &&
    normalizeCollectorNumber(card.number) !== inputNumber
  ) {
    return "number";
  }

  if (!inputSetCode && !inputNumber && !cardNameDoesNotConflict(card, input)) {
    return "name";
  }

  return undefined;
}

function rarityHintFitsCard(
  card: RiftboundCard,
  rarityHint?: ScanDecisionInput["rarityHint"],
) {
  if (!rarityHint?.rarity || rarityHint.confidence < 0.55 || !card.rarity) {
    return true;
  }

  return normalizeRarity(card.rarity) === normalizeRarity(rarityHint.rarity);
}

function getOcrTieBreakerMatch({
  imageMatches,
  input,
  rarityHint,
}: {
  imageMatches: ImageMatchResult[];
  input: CardScanInput;
  rarityHint?: ScanDecisionInput["rarityHint"];
}) {
  return imageMatches.find((match) => {
    return (
      !getCardTextContradiction(match.card, input) &&
      rarityHintFitsCard(match.card, rarityHint)
    );
  });
}

function buildFailedResult({
  input,
  candidates = [],
  reason,
}: {
  input?: CardScanInput;
  candidates?: RiftboundCard[];
  reason: string;
}): ScanAnalysisResult {
  return {
    status: "failed",
    confidence: "failed",
    input,
    candidates,
    reason,
  };
}

function buildSuccessResult({
  card,
  candidates,
  input,
  reason,
  confidence,
}: {
  card: RiftboundCard;
  candidates: RiftboundCard[];
  input: CardScanInput;
  reason: string;
  confidence: "exact" | "likely" | "uncertain";
}): ScanAnalysisResult {
  return {
    status: "success",
    confidence,
    card,
    candidates,
    input,
    reason,
    isExactCardCandidate: confidence === "exact",
  };
}

export function decideScanResult(
  decisionInput: ScanDecisionInput | LegacyScanDecisionInput,
): ScanAnalysisResult {
  const {
    imageMatches,
    ocrInput: input = {},
    candidates,
    rarityHint,
    mode,
  } = getDecisionInput(decisionInput);
  const [topImageMatch] = imageMatches;

  if (candidates.length === 0) {
    return buildFailedResult({
      input,
      candidates,
      reason: "No matching Riftbound card found.",
    });
  }

  const exactTextCandidate = candidates.find((candidate) =>
    isExactScanMatch(candidate, input),
  );

  if (mode !== "image-first" && exactTextCandidate) {
    return buildSuccessResult({
      card: exactTextCandidate,
      candidates,
      input,
      confidence: "exact",
      reason: "Collector text match",
    });
  }

  if (isStrongImageMatch(topImageMatch)) {
    const contradiction = getCardTextContradiction(topImageMatch!.card, input);

    if (contradiction) {
      return buildSuccessResult({
        card: topImageMatch!.card,
        candidates,
        input,
        confidence: "uncertain",
        reason: `Image match conflicts with OCR ${contradiction} ${topImageMatch!.score.toFixed(3)} / margin ${topImageMatch!.margin.toFixed(3)}`,
      });
    }

    const confidence = isExactScanMatch(topImageMatch!.card, input)
      ? "exact"
      : "likely";

    return buildSuccessResult({
      card: topImageMatch!.card,
      candidates,
      input,
      confidence,
      reason: `Image match ${topImageMatch!.score.toFixed(3)} / margin ${topImageMatch!.margin.toFixed(3)}`,
    });
  }

  if (
    mode === "image-first" &&
    topImageMatch &&
    hasWeakImageMargin(topImageMatch)
  ) {
    const tieBreakerMatch = getOcrTieBreakerMatch({
      imageMatches,
      input,
      rarityHint,
    });

    if (tieBreakerMatch) {
      return buildSuccessResult({
        card: tieBreakerMatch.card,
        candidates,
        input,
        confidence: isExactScanMatch(tieBreakerMatch.card, input)
          ? "exact"
          : "likely",
        reason: `OCR tie-breaker image match ${tieBreakerMatch.score.toFixed(3)} / margin ${topImageMatch.margin.toFixed(3)}`,
      });
    }

    return buildSuccessResult({
      card: topImageMatch.card,
      candidates,
      input,
      confidence: "uncertain",
      reason: `Image variants too close ${topImageMatch.score.toFixed(3)} / margin ${topImageMatch.margin.toFixed(3)}`,
    });
  }

  if (mode === "image-first" && exactTextCandidate && topImageMatch) {
    return buildSuccessResult({
      card: exactTextCandidate,
      candidates,
      input,
      confidence: "uncertain",
      reason: "OCR collector match with weak image confidence",
    });
  }

  if (exactTextCandidate) {
    return buildSuccessResult({
      card: exactTextCandidate,
      candidates,
      input,
      confidence: "exact",
      reason: "Collector text match",
    });
  }

  const fallbackCandidate = getPreferredCandidate(candidates);

  if (fallbackCandidate) {
    return buildSuccessResult({
      card: fallbackCandidate,
      candidates,
      input,
      confidence: "uncertain",
      reason: "Best text candidate",
    });
  }

  return buildFailedResult({
    input,
    candidates,
    reason: "No matching Riftbound card found.",
  });
}
