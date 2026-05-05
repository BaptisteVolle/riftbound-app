import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import type { ImageMatchResult } from "./scan-image-match.service";
import { isExactScanMatch } from "./scan-text.service";
import type { ScanAnalysisResult } from "../scan.types";
import { getPreferredCandidate } from "./scan-candidates.service";

const STRONG_IMAGE_SIMILARITY = 0.68;
const STRONG_IMAGE_MARGIN = 0.0035;

function isStrongImageMatch(imageMatch?: ImageMatchResult) {
  return Boolean(
    imageMatch &&
    imageMatch.score >= STRONG_IMAGE_SIMILARITY &&
    imageMatch.margin >= STRONG_IMAGE_MARGIN,
  );
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

export function decideScanResult({
  input,
  candidates,
  imageMatch,
}: {
  input: CardScanInput;
  candidates: RiftboundCard[];
  imageMatch?: ImageMatchResult;
}): ScanAnalysisResult {
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

  if (exactTextCandidate) {
    return buildSuccessResult({
      card: exactTextCandidate,
      candidates,
      input,
      confidence: "exact",
      reason: "Collector text match",
    });
  }

  if (isStrongImageMatch(imageMatch)) {
    return buildSuccessResult({
      card: imageMatch!.card,
      candidates,
      input,
      confidence: "exact",
      reason: `Image match ${imageMatch!.score.toFixed(3)} / margin ${imageMatch!.margin.toFixed(3)}`,
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
