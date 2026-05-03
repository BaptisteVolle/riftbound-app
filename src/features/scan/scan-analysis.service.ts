import type { CardScanInput } from '../cards/cards.types';
import { findRiftCodexCardFromScan } from '../riftcodex/riftcodex.service';
import {
  chooseValidatedCard,
  getCollectorMatch,
  getManualScanInput,
  getStableScanCandidates,
  hasAnyScanInput,
  isExactScanMatch,
  isSureTextMatch,
} from './scan-match.service';
import { scanCardTextFromPhoto } from './ocr.service';
import type { RarityHint } from './ocr.service';
import type {
  ScanAnalysisResult,
  ScanAnalysisStep,
  ScanAnalysisSuccess,
} from './scan.types';

type ScanStepListener = (step: ScanAnalysisStep, message: string) => void;

type AnalyzeOptions = {
  onStep?: ScanStepListener;
};

type AnalyzeInput = {
  input: CardScanInput;
  photoUri?: string;
};

function getScanErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (
    message.includes('Native module') ||
    message.includes('Cannot find native module')
  ) {
    return 'OCR needs a native dev build. Manual text search still works.';
  }

  return 'OCR or RiftCodex lookup failed. Edit the fields or try another photo.';
}

function getScanConfidence({
  isExactCardCandidate,
  reason,
}: {
  isExactCardCandidate: boolean;
  reason: string;
}): ScanAnalysisSuccess['confidence'] {
  if (isExactCardCandidate) {
    return 'exact';
  }

  if (reason.startsWith('Rarity hint')) {
    return 'uncertain';
  }

  return 'likely';
}

async function analyzeCardScan(
  { input, photoUri }: AnalyzeInput,
  options: AnalyzeOptions = {},
): Promise<ScanAnalysisResult> {
  options.onStep?.('reading-text', 'Checking text...');

  let scanInput = input;
  let rarityHint: RarityHint | undefined;

  if (photoUri) {
    const ocrResult = await scanCardTextFromPhoto(photoUri);
    scanInput = ocrResult.input;
    rarityHint = ocrResult.rarityHint;
  }

  if (!hasAnyScanInput(scanInput)) {
    return {
      status: 'failed',
      confidence: 'failed',
      candidates: [],
      input: scanInput,
      reason: photoUri
        ? 'OCR did not find enough card text. Edit the fields or retake the photo.'
        : 'Enter at least a name, set, or number before checking.',
    };
  }

  options.onStep?.('matching-card', 'Finding card candidates...');

  const statusParts: string[] = [];
  const collectorMatch = getCollectorMatch(scanInput, photoUri);

  if (
    photoUri &&
    collectorMatch?.card &&
    scanInput.setCode &&
    scanInput.number &&
    collectorMatch.input.setCode &&
    collectorMatch.input.number &&
    (collectorMatch.input.setCode !== scanInput.setCode ||
      collectorMatch.input.number !== scanInput.number)
  ) {
    statusParts.push(
      `OCR read ${scanInput.setCode.toUpperCase()} ${scanInput.number}; using likely ${collectorMatch.input.setCode} ${collectorMatch.input.number}.`,
    );
  }

  const baseCard =
    collectorMatch?.card ?? (await findRiftCodexCardFromScan(scanInput));

  if (!baseCard) {
    const canSearchByName = Boolean(scanInput.name?.trim());

    return {
      status: 'failed',
      confidence: 'failed',
      candidates: getStableScanCandidates(scanInput),
      input: scanInput,
      reason: canSearchByName
        ? 'No exact local match. You can search Cardmarket by name.'
        : 'No match yet. Edit the fields or retake the photo.',
    };
  }

  const candidates = getStableScanCandidates(scanInput, baseCard);
  options.onStep?.(
    photoUri && !isSureTextMatch(baseCard, scanInput)
      ? 'validating-image'
      : 'checking-variants',
    photoUri && !isSureTextMatch(baseCard, scanInput)
      ? 'Checking image...'
      : 'Checking variants...',
  );

  const validatedCard = await chooseValidatedCard({
    baseCard,
    candidates,
    input: scanInput,
    photoUri,
    rarityHint,
  });
  const selectedCard = validatedCard.card;
  const isExactCardCandidate =
    validatedCard.isValidated ||
    selectedCard.matchConfidence === 'exact' ||
    isExactScanMatch(selectedCard, scanInput);
  const reason = [...statusParts, validatedCard.reason].join(' ');

  return {
    status: 'success',
    confidence: getScanConfidence({
      isExactCardCandidate,
      reason: validatedCard.reason,
    }),
    card: selectedCard,
    candidates,
    input: scanInput,
    reason,
    isExactCardCandidate,
  };
}

export async function analyzeCardScanFromPhoto(
  photoUri: string,
  options: AnalyzeOptions = {},
): Promise<ScanAnalysisResult> {
  try {
    return await analyzeCardScan(
      {
        input: {},
        photoUri,
      },
      options,
    );
  } catch (error) {
    return {
      status: 'failed',
      confidence: 'failed',
      candidates: [],
      reason: getScanErrorMessage(error),
    };
  }
}

export async function analyzeCardScanFromManualInput(
  {
    name,
    setCode,
    number,
  }: {
    name: string;
    setCode: string;
    number: string;
  },
  options: AnalyzeOptions = {},
): Promise<ScanAnalysisResult> {
  try {
    return await analyzeCardScan(
      {
        input: getManualScanInput(name, setCode, number),
      },
      options,
    );
  } catch (error) {
    return {
      status: 'failed',
      confidence: 'failed',
      candidates: [],
      input: getManualScanInput(name, setCode, number),
      reason: getScanErrorMessage(error),
    };
  }
}
