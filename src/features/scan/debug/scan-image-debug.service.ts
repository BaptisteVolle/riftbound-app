import { SCAN_IMAGE_DEBUG } from "./scan-debug-flag";
import type { CardImageIndexStats } from "../scan-logic/scan-image-index.service";
import type {
  ImageMatchResult,
  ScanCardImageCropKind,
  ScanCardImageRegion,
} from "../scan-logic/scan-image-signature.types";

type ScanImageMatchDebugSource = "local-index" | "runtime-fallback";

type LogScanImageMatchesInput = {
  rankedMatches: ImageMatchResult[];
  region: ScanCardImageRegion;
  cropKind: ScanCardImageCropKind;
  source: ScanImageMatchDebugSource;
  indexStats: CardImageIndexStats;
};

function roundScore(value: number) {
  return Number(value.toFixed(4));
}

function getSecondDifferentImageMatch(
  matches: ImageMatchResult[],
  bestMatch?: ImageMatchResult,
) {
  const bestImageUrl = bestMatch?.entry.imageUrl ?? "";

  return matches.find((match) => match.entry.imageUrl !== bestImageUrl);
}

function getDebugMatch(match: ImageMatchResult) {
  return {
    rank: match.rank,
    cardId: match.card.id,
    name: match.card.name,
    setCode: match.card.setCode,
    number: match.card.number,
    imageUrl: match.entry.imageUrl,
    score: roundScore(match.score),
    margin: roundScore(match.margin),
    rgbSimilarity: roundScore(match.rgbSimilarity),
    dHashSimilarity: roundScore(match.dHashSimilarity),
    histogramSimilarity: roundScore(match.histogramSimilarity),
    signatureVersion: match.entry.signatureVersion,
    layout: match.entry.layout,
    cropKind: match.entry.cropKind,
  };
}

export function logScanImageMatches({
  rankedMatches,
  region,
  cropKind,
  source,
  indexStats,
}: LogScanImageMatchesInput) {
  if (!SCAN_IMAGE_DEBUG) {
    return;
  }

  const [best] = rankedMatches;
  const secondDifferentImageMatch = getSecondDifferentImageMatch(
    rankedMatches,
    best,
  );

  console.log("[IMAGE DEBUG] top matches:", {
    source,
    topN: rankedMatches.length,
    region: {
      cropKind,
      layout: region.layout,
      source: region.source,
      rotationDegrees: region.rotationDegrees ?? 0,
    },
    indexStats,
    matches: rankedMatches.map(getDebugMatch),
  });

  console.log("[IMAGE DEBUG] best match summary:", {
    source,
    signatureVersion: 1,
    cropKind,
    layout: region.layout,
    best: best ? getDebugMatch(best) : undefined,
    secondDifferentImage: secondDifferentImageMatch
      ? getDebugMatch(secondDifferentImageMatch)
      : undefined,
    margin: best ? roundScore(best.margin) : undefined,
  });
}
