import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import type { ScanAnalysisResult, ScanAnalysisStep } from "../scan.types";
import { SCAN_IMAGE_FIRST } from "../debug/scan-debug-flag";
import { decideScanResult } from "./scan-decision.service";
import {
  findBestImageMatch,
  findImageMatches,
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
  if (SCAN_IMAGE_FIRST) {
    options.onStep?.("validating-image", "Checking image...");

    const imageMatches = await findImageMatches(
      {
        uri: photoUri,
        cropKind: "artwork",
        source: "overlay-crop",
        layout: "portrait",
      },
      {
        mode: "full-index",
        topN: 10,
      },
    );

    options.onStep?.("reading-text", "Checking text...");

    const ocr = await readCardOcr(photoUri);
    const textCandidates = hasAnyScanInput(ocr.input)
      ? getScanCandidates(ocr.input)
      : [];
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
      input: ocr.input,
      candidates,
      imageMatch: imageMatches[0],
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
