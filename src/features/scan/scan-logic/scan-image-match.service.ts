import { Directory, File, Paths } from "expo-file-system";
import type { RiftboundCard } from "../../cards/cards.types";
import {
  SCAN_IMAGE_DEBUG,
  SCAN_IMAGE_MATCH_CROP_KIND,
  SCAN_IMAGE_SIGNATURE_TARGET_CARD_ID,
} from "../debug/scan-debug-flag";
import { logScanImageMatches } from "../debug/scan-image-debug.service";
import {
  getCardImageIndexStats,
  getIndexedCardImageEntries,
  type IndexedCardImageEntry,
} from "./scan-image-index.service";
import {
  CARD_IMAGE_HISTOGRAM_BINS,
  CARD_IMAGE_THUMBNAIL_SIZE,
  compareCardImageSignatures,
  createCardImageSignature,
} from "./scan-image-signature.service";
import type {
  CardImageSignatureV1,
  CardImageIndexEntry,
  ImageMatchResult,
  ScanCardImageCropKind,
  ScanCardImageRegion,
} from "./scan-image-signature.types";

export type { ImageMatchResult } from "./scan-image-signature.types";

type ImageSignatureOptions = {
  cropKind?: ScanCardImageCropKind;
};

export type FindImageMatchesOptions = {
  candidates?: RiftboundCard[];
  topN?: number;
  cropKind?: ScanCardImageCropKind;
  mode?: "candidate-indexed" | "full-index";
  fallbackToRuntime?: boolean;
};

export type ImageMatchDiagnostic = {
  match?: ImageMatchResult;
  rank?: number;
  totalCompared: number;
  betterMatches: ImageMatchResult[];
};

type SignatureDifferenceDetails = {
  rgbMad: number;
  rgbMadByChannel: {
    red: number;
    green: number;
    blue: number;
  };
  rgbMaxDiff: number;
  rgbMadByQuadrant: {
    topLeft: number;
    topRight: number;
    bottomLeft: number;
    bottomRight: number;
  };
  dHashHammingDistance: number;
  histogramL1Distance: number;
  topHistogramDifferences: Array<{
    bin: number;
    scan: number;
    target: number;
    delta: number;
  }>;
  scanSignaturePreview: {
    dHash: string;
    rgbTinyFirst24: number[];
    histogramTopBins: Array<{ bin: number; value: number }>;
  };
  targetSignaturePreview: {
    dHash: string;
    rgbTinyFirst24: number[];
    histogramTopBins: Array<{ bin: number; value: number }>;
  };
};

const IMAGE_CACHE_DIRECTORY = new Directory(
  Paths.cache,
  "riftbound-card-images",
);

function getImageExtension(value: string) {
  const pathname = value.split("?")[0] ?? "";
  const extension = pathname.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase();

  if (!extension) {
    return "jpg";
  }

  return extension === "jpeg" ? "jpg" : extension;
}

function getSafeFileName(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return `${hash.toString(16)}.${getImageExtension(value)}`;
}

function ensureImageCacheDirectory() {
  if (!IMAGE_CACHE_DIRECTORY.exists) {
    IMAGE_CACHE_DIRECTORY.create({
      idempotent: true,
      intermediates: true,
    });
  }
}

async function getLocalImageUri(uri: string) {
  if (!/^https?:\/\//i.test(uri)) {
    return uri;
  }

  ensureImageCacheDirectory();

  const imageFile = new File(IMAGE_CACHE_DIRECTORY, getSafeFileName(uri));

  if (!imageFile.exists) {
    await File.downloadFileAsync(uri, imageFile, {
      idempotent: true,
    });
  }

  return imageFile.uri;
}

async function getImageSignature(
  uri: string,
  region: Omit<ScanCardImageRegion, "uri">,
) {
  const localUri = await getLocalImageUri(uri);

  if (SCAN_IMAGE_DEBUG) {
    console.log("[IMAGE] signature source:", {
      originalUri: uri,
      localUri,
      cropKind: region.cropKind,
      layout: region.layout,
      source: region.source,
    });
  }

  return createCardImageSignature({
    ...region,
    uri: localUri,
  });
}

function getLegacyIndexEntry(
  card: RiftboundCard & { imageUrl: string },
  signature: CardImageSignatureV1,
  region: Omit<ScanCardImageRegion, "uri">,
): CardImageIndexEntry {
  return {
    cardId: card.id,
    externalId: card.externalId,
    name: card.name,
    setCode: card.setCode,
    number: card.number,
    imageUrl: card.imageUrl,
    signatureVersion: 1,
    cropKind: region.cropKind,
    layout: region.layout,
    thumbnailSize: CARD_IMAGE_THUMBNAIL_SIZE,
    histogramBins: CARD_IMAGE_HISTOGRAM_BINS,
    signature,
  };
}

function getSecondDifferentImageMatch(
  matches: ImageMatchResult[],
  bestMatch?: ImageMatchResult,
) {
  const bestImageUrl = bestMatch?.entry.imageUrl ?? "";

  return matches.find((match) => match.entry.imageUrl !== bestImageUrl);
}

function rankMatches(matches: ImageMatchResult[]) {
  const sortedMatches = matches.sort((left, right) => right.score - left.score);

  return sortedMatches.map((match, index) => {
    const secondDifferentImageMatch =
      index === 0
        ? getSecondDifferentImageMatch(sortedMatches, match)
        : undefined;

    return {
      ...match,
      margin:
        index === 0
          ? match.score - (secondDifferentImageMatch?.score ?? 0)
          : match.margin,
      rank: index + 1,
    };
  });
}

function getCandidateIds(candidates?: RiftboundCard[]) {
  return new Set((candidates ?? []).map((candidate) => candidate.id));
}

function getIndexedEntriesForOptions(options: FindImageMatchesOptions) {
  const mode = options.mode ?? "candidate-indexed";
  const indexedEntries = getIndexedCardImageEntries();

  if (mode === "full-index") {
    return indexedEntries;
  }

  const candidateIds = getCandidateIds(options.candidates);

  if (candidateIds.size === 0) {
    return [];
  }

  return indexedEntries.filter(({ card }) => candidateIds.has(card.id));
}

function scoreIndexedEntries({
  photoSignature,
  indexedEntries,
  region,
  cropKind,
}: {
  photoSignature: CardImageSignatureV1;
  indexedEntries: IndexedCardImageEntry[];
  region: ScanCardImageRegion;
  cropKind: ScanCardImageCropKind;
}) {
  return indexedEntries
    .filter(({ entry }) => entry.layout === region.layout)
    .filter(({ entry }) => entry.cropKind === cropKind)
    .map(({ card, entry }): ImageMatchResult => {
      const comparison = compareCardImageSignatures(
        photoSignature,
        entry.signature,
      );

      return {
        card,
        entry,
        score: comparison.score,
        margin: 0,
        rgbSimilarity: comparison.rgbSimilarity,
        dHashSimilarity: comparison.dHashSimilarity,
        histogramSimilarity: comparison.histogramSimilarity,
        rank: 0,
      };
    });
}

function roundDebugNumber(value: number) {
  return Number(value.toFixed(4));
}

function getHammingDistance(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length) * 4;

  for (let index = 0; index < length; index += 1) {
    const leftNibble = Number.parseInt(left[index], 16);
    const rightNibble = Number.parseInt(right[index], 16);
    let diff = leftNibble ^ rightNibble;

    while (diff > 0) {
      distance += diff & 1;
      diff >>= 1;
    }
  }

  return distance;
}

function getHistogramTopBins(values: number[]) {
  return values
    .map((value, bin) => ({ bin, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)
    .map(({ bin, value }) => ({
      bin,
      value: roundDebugNumber(value),
    }));
}

function getSignatureDifferenceDetails({
  scanSignature,
  targetSignature,
}: {
  scanSignature: CardImageSignatureV1;
  targetSignature: CardImageSignatureV1;
}): SignatureDifferenceDetails {
  const length = Math.min(
    scanSignature.rgbTiny.length,
    targetSignature.rgbTiny.length,
  );
  const channelTotals = [0, 0, 0];
  const quadrantTotals = [0, 0, 0, 0];
  const quadrantCounts = [0, 0, 0, 0];
  let totalDifference = 0;
  let maxDifference = 0;

  for (let index = 0; index < length; index += 1) {
    const difference = Math.abs(
      scanSignature.rgbTiny[index] - targetSignature.rgbTiny[index],
    );
    const channel = index % 3;
    const pixelIndex = Math.floor(index / 3);
    const x = pixelIndex % CARD_IMAGE_THUMBNAIL_SIZE;
    const y = Math.floor(pixelIndex / CARD_IMAGE_THUMBNAIL_SIZE);
    const quadrant =
      (y >= CARD_IMAGE_THUMBNAIL_SIZE / 2 ? 2 : 0) +
      (x >= CARD_IMAGE_THUMBNAIL_SIZE / 2 ? 1 : 0);

    totalDifference += difference;
    channelTotals[channel] += difference;
    quadrantTotals[quadrant] += difference;
    quadrantCounts[quadrant] += 1;
    maxDifference = Math.max(maxDifference, difference);
  }

  const pixelCount = Math.max(1, length / 3);
  const histogramLength = Math.min(
    scanSignature.colorHistogram.length,
    targetSignature.colorHistogram.length,
  );
  const histogramDifferences = Array.from(
    { length: histogramLength },
    (_, bin) => {
      const scan = scanSignature.colorHistogram[bin];
      const target = targetSignature.colorHistogram[bin];

      return {
        bin,
        scan,
        target,
        delta: scan - target,
      };
    },
  );
  const histogramL1Distance = histogramDifferences.reduce(
    (total, { delta }) => total + Math.abs(delta),
    0,
  );

  return {
    rgbMad: roundDebugNumber(totalDifference / Math.max(1, length)),
    rgbMadByChannel: {
      red: roundDebugNumber(channelTotals[0] / pixelCount),
      green: roundDebugNumber(channelTotals[1] / pixelCount),
      blue: roundDebugNumber(channelTotals[2] / pixelCount),
    },
    rgbMaxDiff: maxDifference,
    rgbMadByQuadrant: {
      topLeft: roundDebugNumber(quadrantTotals[0] / Math.max(1, quadrantCounts[0])),
      topRight: roundDebugNumber(quadrantTotals[1] / Math.max(1, quadrantCounts[1])),
      bottomLeft: roundDebugNumber(
        quadrantTotals[2] / Math.max(1, quadrantCounts[2]),
      ),
      bottomRight: roundDebugNumber(
        quadrantTotals[3] / Math.max(1, quadrantCounts[3]),
      ),
    },
    dHashHammingDistance: getHammingDistance(
      scanSignature.dHash,
      targetSignature.dHash,
    ),
    histogramL1Distance: roundDebugNumber(histogramL1Distance),
    topHistogramDifferences: histogramDifferences
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 10)
      .map(({ bin, scan, target, delta }) => ({
        bin,
        scan: roundDebugNumber(scan),
        target: roundDebugNumber(target),
        delta: roundDebugNumber(delta),
      })),
    scanSignaturePreview: {
      dHash: scanSignature.dHash,
      rgbTinyFirst24: scanSignature.rgbTiny.slice(0, 24),
      histogramTopBins: getHistogramTopBins(scanSignature.colorHistogram),
    },
    targetSignaturePreview: {
      dHash: targetSignature.dHash,
      rgbTinyFirst24: targetSignature.rgbTiny.slice(0, 24),
      histogramTopBins: getHistogramTopBins(targetSignature.colorHistogram),
    },
  };
}

function getMatchDebugSummary(match: ImageMatchResult) {
  return {
    id: match.card.id,
    name: match.card.name,
    setCode: match.card.setCode,
    number: match.card.number,
    rank: match.rank,
    score: roundDebugNumber(match.score),
    margin: roundDebugNumber(match.margin),
    rgbSimilarity: roundDebugNumber(match.rgbSimilarity),
    dHashSimilarity: roundDebugNumber(match.dHashSimilarity),
    histogramSimilarity: roundDebugNumber(match.histogramSimilarity),
  };
}

async function findRuntimeImageMatches(
  options: FindImageMatchesOptions,
  signatureRegion: Omit<ScanCardImageRegion, "uri">,
  photoSignature: CardImageSignatureV1,
) {
  const imageCandidates = (options.candidates ?? []).filter(
    (candidate): candidate is RiftboundCard & { imageUrl: string } =>
      Boolean(candidate.imageUrl),
  );

  if (imageCandidates.length < 2) {
    return [];
  }

  const scoredCandidates: ImageMatchResult[] = [];

  for (const candidate of imageCandidates.slice(0, 8)) {
    try {
      const candidateSignature = await getImageSignature(
        candidate.imageUrl,
        signatureRegion,
      );
      const comparison = compareCardImageSignatures(
        photoSignature,
        candidateSignature,
      );

      scoredCandidates.push({
        card: candidate,
        entry: getLegacyIndexEntry(
          candidate,
          candidateSignature,
          signatureRegion,
        ),
        score: comparison.score,
        margin: 0,
        rgbSimilarity: comparison.rgbSimilarity,
        dHashSimilarity: comparison.dHashSimilarity,
        histogramSimilarity: comparison.histogramSimilarity,
        rank: 0,
      });
    } catch {
      // Some remote candidate images may be unavailable. Keep the scan usable.
    }
  }

  return scoredCandidates;
}

export async function logTargetImageSignatureDiagnostic(
  region: ScanCardImageRegion,
  targetCardId = SCAN_IMAGE_SIGNATURE_TARGET_CARD_ID,
) {
  if (!targetCardId) {
    return;
  }

  try {
    const cropKind = region.cropKind;
    const signatureRegion = {
      cropKind,
      source: region.source,
      layout: region.layout,
      rotationDegrees: region.rotationDegrees,
    };
    const indexedEntries = getIndexedCardImageEntries();
    const targetEntry = indexedEntries.find(({ card, entry }) => {
      return (
        card.id === targetCardId &&
        entry.cropKind === cropKind &&
        entry.layout === region.layout
      );
    });

    if (!targetEntry) {
      console.log("[IMAGE TARGET DEBUG] target not found:", {
        targetCardId,
        cropKind,
        layout: region.layout,
        indexStats: getCardImageIndexStats(),
      });
      return;
    }

    const scanSignature = await getImageSignature(region.uri, signatureRegion);
    const comparison = compareCardImageSignatures(
      scanSignature,
      targetEntry.entry.signature,
    );
    const rankedMatches = rankMatches(
      scoreIndexedEntries({
        photoSignature: scanSignature,
        indexedEntries,
        region,
        cropKind,
      }),
    );
    const targetMatch = rankedMatches.find(
      (match) => match.card.id === targetEntry.card.id,
    );

    console.log("[IMAGE TARGET DEBUG] direct signature comparison:", {
      target: {
        id: targetEntry.card.id,
        name: targetEntry.card.name,
        setCode: targetEntry.card.setCode,
        number: targetEntry.card.number,
        imageUrl: targetEntry.entry.imageUrl,
        cropKind: targetEntry.entry.cropKind,
        layout: targetEntry.entry.layout,
      },
      region: {
        cropKind,
        layout: region.layout,
        source: region.source,
        rotationDegrees: region.rotationDegrees ?? 0,
      },
      comparison: {
        score: roundDebugNumber(comparison.score),
        rgbSimilarity: roundDebugNumber(comparison.rgbSimilarity),
        dHashSimilarity: roundDebugNumber(comparison.dHashSimilarity),
        histogramSimilarity: roundDebugNumber(comparison.histogramSimilarity),
      },
      rank: targetMatch?.rank,
      totalCompared: rankedMatches.length,
      targetMatch: targetMatch ? getMatchDebugSummary(targetMatch) : undefined,
      betterMatches: targetMatch
        ? rankedMatches
            .slice(0, Math.max(0, targetMatch.rank - 1))
            .slice(0, 8)
            .map(getMatchDebugSummary)
        : rankedMatches.slice(0, 8).map(getMatchDebugSummary),
      differences: getSignatureDifferenceDetails({
        scanSignature,
        targetSignature: targetEntry.entry.signature,
      }),
    });
  } catch (error) {
    console.log("[IMAGE TARGET DEBUG] failed:", {
      targetCardId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function findImageMatches(
  region: ScanCardImageRegion,
  options: FindImageMatchesOptions = {},
): Promise<ImageMatchResult[]> {
  if (!region.uri) {
    return [];
  }

  try {
    const cropKind = options.cropKind ?? region.cropKind;
    const topN = options.topN ?? 10;
    const signatureRegion = {
      cropKind,
      source: region.source,
      layout: region.layout,
      rotationDegrees: region.rotationDegrees,
    };
    const photoSignature = await getImageSignature(region.uri, signatureRegion);
    const indexedMatches = scoreIndexedEntries({
      photoSignature,
      indexedEntries: getIndexedEntriesForOptions(options),
      region,
      cropKind,
    });
    const rankedIndexedMatches = rankMatches(indexedMatches).slice(0, topN);

    if (rankedIndexedMatches.length > 0) {
      logScanImageMatches({
        rankedMatches: rankedIndexedMatches,
        region,
        cropKind,
        source: "local-index",
        indexStats: getCardImageIndexStats(),
      });

      return rankedIndexedMatches;
    }

    if (options.fallbackToRuntime === false) {
      return [];
    }

    const runtimeMatches = await findRuntimeImageMatches(
      options,
      signatureRegion,
      photoSignature,
    );
    const rankedRuntimeMatches = rankMatches(runtimeMatches).slice(0, topN);

    logScanImageMatches({
      rankedMatches: rankedRuntimeMatches,
      region,
      cropKind,
      source: "runtime-fallback",
      indexStats: getCardImageIndexStats(),
    });

    return rankedRuntimeMatches;
  } catch {
    return [];
  }
}

export async function findImageMatchDiagnostic(
  region: ScanCardImageRegion,
  card: RiftboundCard,
  options: Pick<FindImageMatchesOptions, "cropKind"> = {},
): Promise<ImageMatchDiagnostic> {
  if (!region.uri) {
    return {
      totalCompared: 0,
      betterMatches: [],
    };
  }

  try {
    const cropKind = options.cropKind ?? region.cropKind;
    const signatureRegion = {
      cropKind,
      source: region.source,
      layout: region.layout,
      rotationDegrees: region.rotationDegrees,
    };
    const photoSignature = await getImageSignature(region.uri, signatureRegion);
    const rankedMatches = rankMatches(
      scoreIndexedEntries({
        photoSignature,
        indexedEntries: getIndexedCardImageEntries(),
        region,
        cropKind,
      }),
    );
    const match = rankedMatches.find((candidate) => candidate.card.id === card.id);

    return {
      match,
      rank: match?.rank,
      totalCompared: rankedMatches.length,
      betterMatches: match
        ? rankedMatches.slice(0, Math.max(0, match.rank - 1)).slice(0, 5)
        : rankedMatches.slice(0, 5),
    };
  } catch {
    return {
      totalCompared: 0,
      betterMatches: [],
    };
  }
}

export async function findBestImageMatch(
  photoUri: string,
  candidates: RiftboundCard[],
  options: ImageSignatureOptions = { cropKind: SCAN_IMAGE_MATCH_CROP_KIND },
): Promise<ImageMatchResult | undefined> {
  const [bestMatch] = await findImageMatches(
    {
      uri: photoUri,
      cropKind: options.cropKind ?? SCAN_IMAGE_MATCH_CROP_KIND,
      source: "overlay-crop",
      layout: "portrait",
    },
    {
      candidates,
      cropKind: options.cropKind ?? SCAN_IMAGE_MATCH_CROP_KIND,
      topN: 1,
    },
  );

  return bestMatch;
}
