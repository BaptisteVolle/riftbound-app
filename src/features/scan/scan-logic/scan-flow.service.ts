import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import type { ScanAnalysisResult, ScanAnalysisStep } from "../scan.types";
import {
  SCAN_IMAGE_DEBUG,
  SCAN_IMAGE_FIRST,
  SCAN_IMAGE_MATCH_CROP_KIND,
  SCAN_IMAGE_SIGNATURE_ONLY_DEBUG,
  SCAN_IMAGE_SIGNATURE_TARGET_CARD_ID,
} from "../debug/scan-debug-flag";
import { decideScanResult } from "./scan-decision.service";
import {
  findBestImageMatch,
  findImageMatchDiagnostic,
  findImageMatches,
  logTargetImageSignatureDiagnostic,
} from "./scan-image-match.service";
import {
  getScanCandidates,
  mergeCardCandidates,
} from "./scan-candidates.service";
import { readCardOcr } from "./scan-ocr.service";
import {
  getManualScanInput,
  hasAnyScanInput,
  isExactScanMatch,
} from "./scan-text.service";
type ScanFlowOptions = {
  onStep?: (step: ScanAnalysisStep, message: string) => void;
};

function roundImageScore(value: number) {
  return Number(value.toFixed(4));
}

function getImageDebugSummary(match: Awaited<ReturnType<typeof findImageMatches>>[number]) {
  return {
    id: match.card.id,
    name: match.card.name,
    setCode: match.card.setCode,
    number: match.card.number,
    rank: match.rank,
    score: roundImageScore(match.score),
    margin: roundImageScore(match.margin),
    rgbSimilarity: roundImageScore(match.rgbSimilarity),
    dHashSimilarity: roundImageScore(match.dHashSimilarity),
    histogramSimilarity: roundImageScore(match.histogramSimilarity),
  };
}

async function logImageFirstOcrDiagnostic({
  region,
  imageMatches,
  textCandidates,
  input,
}: {
  region: Parameters<typeof findImageMatches>[0];
  imageMatches: Awaited<ReturnType<typeof findImageMatches>>;
  textCandidates: RiftboundCard[];
  input: CardScanInput;
}) {
  if (!SCAN_IMAGE_DEBUG) {
    return;
  }

  const exactTextCandidate = textCandidates.find((candidate) =>
    isExactScanMatch(candidate, input),
  );
  const matchedImageCandidate = exactTextCandidate
    ? imageMatches.find((match) => match.card.id === exactTextCandidate.id)
    : undefined;
  const exactTextDiagnostic = exactTextCandidate
    ? await findImageMatchDiagnostic(region, exactTextCandidate)
    : undefined;

  console.log("[IMAGE DEBUG] OCR validation candidate:", {
    input,
    exactTextCandidate: exactTextCandidate
      ? {
          id: exactTextCandidate.id,
          name: exactTextCandidate.name,
          setCode: exactTextCandidate.setCode,
          number: exactTextCandidate.number,
        }
      : undefined,
    imageRank: matchedImageCandidate?.rank,
    imageScore: matchedImageCandidate
      ? roundImageScore(matchedImageCandidate.score)
      : undefined,
    imageMargin: matchedImageCandidate
      ? roundImageScore(matchedImageCandidate.margin)
      : undefined,
    topImage: imageMatches[0] ? getImageDebugSummary(imageMatches[0]) : undefined,
    exactTextImageDiagnostic: exactTextDiagnostic
      ? {
          rank: exactTextDiagnostic.rank,
          totalCompared: exactTextDiagnostic.totalCompared,
          match: exactTextDiagnostic.match
            ? getImageDebugSummary(exactTextDiagnostic.match)
            : undefined,
          betterMatches: exactTextDiagnostic.betterMatches.map(getImageDebugSummary),
        }
      : undefined,
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

async function scanCardFromInput({
  input,
  photoUri,
  options = {},
}: {
  input: CardScanInput;
  photoUri?: string;
  options?: ScanFlowOptions;
}): Promise<ScanAnalysisResult> {
  if (!hasAnyScanInput(input)) {
    return buildFailedResult({
      input,
      reason: photoUri
        ? "No readable card text found."
        : "Enter a card name, set, or number.",
    });
  }

  options.onStep?.("matching-card", "Finding card candidates...");

  const candidates = getScanCandidates(input);

  if (candidates.length === 0) {
    return buildFailedResult({
      input,
      candidates,
      reason: "No matching Riftbound card found.",
    });
  }

  const hasExactTextCandidate = candidates.some((candidate) =>
    isExactScanMatch(candidate, input),
  );

  const shouldCheckImage = Boolean(
    photoUri && candidates.length >= 2 && !hasExactTextCandidate,
  );

  if (shouldCheckImage) {
    options.onStep?.("validating-image", "Checking image...");
  }

  const imageMatch = shouldCheckImage
    ? await findBestImageMatch(photoUri!, candidates)
    : undefined;

  return decideScanResult({
    input,
    candidates,
    imageMatch,
  });
}

export async function scanCardFromPhoto(
  photoUri: string,
  options: ScanFlowOptions = {},
): Promise<ScanAnalysisResult> {
  const imageRegion = {
    uri: photoUri,
    cropKind: SCAN_IMAGE_MATCH_CROP_KIND,
    source: "overlay-crop",
    layout: "portrait",
  } as const;

  if (SCAN_IMAGE_SIGNATURE_TARGET_CARD_ID) {
    options.onStep?.("validating-image", "Checking target image signature...");
    await logTargetImageSignatureDiagnostic(imageRegion);

    if (SCAN_IMAGE_SIGNATURE_ONLY_DEBUG) {
      return buildFailedResult({
        reason:
          "Image signature target debug completed. Check [IMAGE TARGET DEBUG] logs.",
      });
    }
  }

  if (SCAN_IMAGE_FIRST) {
    options.onStep?.("validating-image", "Checking image...");

    const imageMatches = await findImageMatches(imageRegion, {
        mode: "full-index",
        topN: SCAN_IMAGE_DEBUG ? 100 : 10,
      });

    options.onStep?.("reading-text", "Checking text...");

    const ocr = await readCardOcr(photoUri);
    const textCandidates = hasAnyScanInput(ocr.input)
      ? getScanCandidates(ocr.input)
      : [];

    await logImageFirstOcrDiagnostic({
      region: imageRegion,
      imageMatches,
      textCandidates,
      input: ocr.input,
    });

    const candidates = mergeCardCandidates([
      ...imageMatches.map((match) => match.card),
      ...textCandidates,
    ]);

    if (candidates.length === 0) {
      return buildFailedResult({
        input: ocr.input,
        candidates,
        reason: "No matching Riftbound card found.",
      });
    }

    return decideScanResult({
      ocrInput: ocr.input,
      candidates,
      imageMatches,
      rarityHint: ocr.rarityHint,
      mode: "image-first",
    });
  }

  options.onStep?.("reading-text", "Checking text...");

  const ocr = await readCardOcr(photoUri);

  return scanCardFromInput({
    input: ocr.input,
    photoUri,
    options,
  });
}

export async function scanCardFromManualInput(
  {
    name,
    setCode,
    number,
  }: {
    name: string;
    setCode: string;
    number: string;
  },
  options: ScanFlowOptions = {},
): Promise<ScanAnalysisResult> {
  return scanCardFromInput({
    input: getManualScanInput(name, setCode, number),
    options,
  });
}
