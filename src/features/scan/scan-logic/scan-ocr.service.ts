import type {
  TextLine,
  TextRecognitionResult,
} from "@react-native-ml-kit/text-recognition";

import type { CardScanInput } from "../../cards/cards.types";
import { normalizeCollectorNumber } from "../../riftcodex/riftcodex.service";
import { cropScanImage } from "./scan-image-crop.service";
import { getStringSimilarity } from "../../../lib/string-similarity";
import { getCardexCards } from "../../cards/cards.service";
import { normalizeScanText } from "./scan-text.service";
import { SCAN_OCR_DEBUG } from "../debug/scan-debug-flag";

const SET_CODES = [
  "JDG",
  "OGN",
  "OGNX",
  "OGS",
  "OPP",
  "PR",
  "PROK",
  "SFD",
  "SFDX",
  "UNL",
];

const SET_CODE_PATTERN = SET_CODES.join("|");

const CARD_NAME_SUFFIXES =
  /\s+(\(?(Alternate Art|Overnumbered|Signature|Metal)\)?)$/i;

const CARD_TYPE_WORDS = new Set([
  "champion",
  "unit",
  "spell",
  "rune",
  "gear",
  "battlefield",
  "legend",
]);

const RARITY_LABELS = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Showcase",
  "Promo",
] as const;

export type RarityHint = {
  rarity: (typeof RARITY_LABELS)[number];
  confidence: number;
  sourceText: string;
};

type PositionedTextLine = {
  text: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  rawLine: TextLine;
};

type OcrRegion = {
  minTop?: number;
  maxTop?: number;
  minBottom?: number;
  maxBottom?: number;
  minLeft?: number;
  maxLeft?: number;
  minRight?: number;
  maxRight?: number;
};

export type OcrNameCandidate = {
  text: string;
  cleanedText: string;
  score: number;
  source: "name-band" | "rune-center" | "global";
  line?: PositionedTextLine;
};

export type OcrCollectorCandidate = {
  setCode?: string;
  number?: string;
  score: number;
  source: "bottom-left" | "bottom" | "global";
  rawText: string;
};

export type CardOcrParseResult = {
  input: CardScanInput;
  nameCandidates: OcrNameCandidate[];
  collectorCandidates: OcrCollectorCandidate[];
};

export type ScanOcrResult = {
  input: CardScanInput;
  rawText: string;
  rarityHint?: RarityHint;
  nameCandidates: OcrNameCandidate[];
  collectorCandidates: OcrCollectorCandidate[];
};

export function normalizeOcrText(text: string) {
  return text
    .replace(/[|]/g, "I")
    .replace(/\u2022/g, "*")
    .replace(/\u00b7/g, "*")
    .replace(/[Oo](?=\s*\/\s*\d{2,3})/g, "0")
    .replace(/[Il](?=\s*\/\s*\d{2,3})/g, "1")
    .replace(/[\u2010-\u2015]/g, "-");
}

function getWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function looksLikeTypeOrTagLine(value: string) {
  const words = getWords(value);

  if (words.length < 2) {
    return false;
  }

  const cardTypeCount = words.filter((word) =>
    CARD_TYPE_WORDS.has(word),
  ).length;

  if (cardTypeCount >= 1 && words.length >= 4) {
    return true;
  }

  const uppercaseLetters = value.replace(/[^A-Z]/g, "").length;
  const lowercaseLetters = value.replace(/[^a-z]/g, "").length;
  const isMostlyUppercase = uppercaseLetters > lowercaseLetters * 2;

  return Boolean(
    isMostlyUppercase && /[•·*|-]/.test(value) && words.length >= 3,
  );
}

function getTextLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function containsSetCode(text: string) {
  return SET_CODES.some((setCode) =>
    new RegExp(`\\b${setCode}\\b`, "i").test(text),
  );
}

export function cleanNameLine(line: string) {
  return line
    .replace(CARD_NAME_SUFFIXES, "")
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyNameLine(line: string) {
  const cleanedLine = cleanNameLine(line);

  if (!cleanedLine || cleanedLine.length < 2) {
    return false;
  }

  if (/^[0-9+\-\s/*]+$/.test(cleanedLine)) {
    return false;
  }

  if (containsSetCode(cleanedLine)) {
    return false;
  }

  if (/\b[0-9OIl]{1,3}[A-Za-z*]?\s*\/\s*[0-9]{2,3}\b/i.test(cleanedLine)) {
    return false;
  }

  if (/^(common|uncommon|rare|epic|showcase|promo)$/i.test(cleanedLine)) {
    return false;
  }

  return /[A-Za-z]/.test(cleanedLine);
}

function getFirstUsefulLine(text: string) {
  return getTextLines(text).find(isLikelyNameLine);
}

function getGlobalNameCandidates(text: string): OcrNameCandidate[] {
  return getTextLines(normalizeOcrText(text))
    .map((line): OcrNameCandidate | undefined => {
      const cleanedText = cleanNameLine(line);

      if (!isLikelyNameLine(cleanedText)) {
        return undefined;
      }

      if (looksLikeTypeOrTagLine(cleanedText)) {
        return undefined;
      }

      return {
        text: line,
        cleanedText,
        score: 30,
        source: "global",
      };
    })
    .filter((candidate): candidate is OcrNameCandidate => Boolean(candidate));
}

function normalizeParsedNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.toUpperCase();
  const [, digits = normalizedValue, suffix = ""] =
    normalizedValue.match(/^([0-9OIL]{1,3})([A-Z*]?)$/) ?? [];

  const correctedDigits = digits.replace(/[O]/g, "0").replace(/[IL]/g, "1");

  return normalizeCollectorNumber(`${correctedDigits}${suffix}`);
}

function findCollectorInputFromText(
  text: string,
): Pick<CardScanInput, "setCode" | "number"> {
  const normalizedText = normalizeOcrText(text);
  const setRegex = new RegExp(`\\b(${SET_CODE_PATTERN})\\b`, "i");
  const setNumberRegex = new RegExp(
    `\\b(${SET_CODE_PATTERN})\\s*[-#:*·]?\\s*([0-9OIl]{1,3}[A-Za-z*]?)(?:\\s*\\/\\s*[0-9]{2,3})?\\b`,
    "i",
  );
  const numberSlashRegex = /\b([0-9OIl]{1,3}[A-Za-z*]?)\s*\/\s*[0-9]{2,3}\b/i;

  const setNumberMatch = normalizedText.match(setNumberRegex);

  if (setNumberMatch) {
    return {
      setCode: setNumberMatch[1].toUpperCase(),
      number: normalizeParsedNumber(setNumberMatch[2]),
    };
  }

  return {
    setCode: normalizedText.match(setRegex)?.[1]?.toUpperCase(),
    number: normalizeParsedNumber(normalizedText.match(numberSlashRegex)?.[1]),
  };
}

function getLineFrame(line: TextLine) {
  if (!line.frame) {
    return undefined;
  }

  return {
    top: line.frame.top,
    bottom: line.frame.top + line.frame.height,
    left: line.frame.left,
    right: line.frame.left + line.frame.width,
    width: line.frame.width,
    height: line.frame.height,
  };
}

function getPositionedTextLines(
  result: TextRecognitionResult,
): PositionedTextLine[] {
  const rawLines = result.blocks
    .flatMap((block) => block.lines)
    .filter((line) => Boolean(line.text.trim() && line.frame));

  if (rawLines.length === 0) {
    return [];
  }

  const frames = rawLines
    .map(getLineFrame)
    .filter((frame): frame is NonNullable<ReturnType<typeof getLineFrame>> =>
      Boolean(frame),
    );

  const maxRight = Math.max(...frames.map((frame) => frame.right), 1);
  const maxBottom = Math.max(...frames.map((frame) => frame.bottom), 1);

  return rawLines
    .map((line) => {
      const frame = getLineFrame(line);

      if (!frame) {
        return undefined;
      }

      return {
        text: line.text.trim(),
        top: frame.top / maxBottom,
        bottom: frame.bottom / maxBottom,
        left: frame.left / maxRight,
        right: frame.right / maxRight,
        width: frame.width / maxRight,
        height: frame.height / maxBottom,
        rawLine: line,
      };
    })
    .filter((line): line is PositionedTextLine => Boolean(line))
    .sort((left, right) => left.top - right.top || left.left - right.left);
}

function isInRegion(line: PositionedTextLine, region: OcrRegion) {
  if (region.minTop !== undefined && line.top < region.minTop) return false;
  if (region.maxTop !== undefined && line.top > region.maxTop) return false;
  if (region.minBottom !== undefined && line.bottom < region.minBottom)
    return false;
  if (region.maxBottom !== undefined && line.bottom > region.maxBottom)
    return false;
  if (region.minLeft !== undefined && line.left < region.minLeft) return false;
  if (region.maxLeft !== undefined && line.left > region.maxLeft) return false;
  if (region.minRight !== undefined && line.right < region.minRight)
    return false;
  if (region.maxRight !== undefined && line.right > region.maxRight)
    return false;

  return true;
}

function getRegionLines(lines: PositionedTextLine[], region: OcrRegion) {
  return lines.filter((line) => isInRegion(line, region));
}

function getRegionText(lines: PositionedTextLine[], region: OcrRegion) {
  return getRegionLines(lines, region)
    .flatMap((line) => [
      line.text,
      ...line.rawLine.elements.map((element) => element.text),
    ])
    .join(" ")
    .trim();
}

function getCombinedTitleCandidates(
  candidates: OcrNameCandidate[],
): OcrNameCandidate[] {
  const positionedCandidates = candidates
    .filter((candidate) => candidate.line)
    .sort((left, right) => {
      return (left.line?.top ?? 0) - (right.line?.top ?? 0);
    });

  const combinedCandidates: OcrNameCandidate[] = [];

  for (let index = 0; index < positionedCandidates.length - 1; index += 1) {
    const current = positionedCandidates[index];
    const next = positionedCandidates[index + 1];

    if (!current.line || !next.line) {
      continue;
    }

    const verticalGap = next.line.top - current.line.bottom;
    const leftDistance = Math.abs(next.line.left - current.line.left);

    const currentLooksLikeTitle =
      current.cleanedText.split(/\s+/).length <= 3 &&
      current.cleanedText.length >= 3;

    const nextLooksLikeSubtitle =
      next.cleanedText.length >= 3 &&
      next.cleanedText.length <= 24 &&
      next.cleanedText === next.cleanedText.toUpperCase();

    if (
      currentLooksLikeTitle &&
      nextLooksLikeSubtitle &&
      verticalGap >= 0 &&
      verticalGap <= 0.04 &&
      leftDistance <= 0.08
    ) {
      combinedCandidates.push({
        text: `${current.text} ${next.text}`,
        cleanedText: cleanNameLine(
          `${current.cleanedText} ${next.cleanedText}`,
        ),
        score: Math.max(current.score, next.score) + 25,
        source: current.source,
        line: current.line,
      });
    }
  }

  return combinedCandidates;
}

function getCollectorCandidatesFromRecognition(
  result: TextRecognitionResult,
): OcrCollectorCandidate[] {
  const lines = getPositionedTextLines(result);
  const candidates: OcrCollectorCandidate[] = [];

  const bottomLeftText = getRegionText(lines, {
    minTop: 0.76,
    maxLeft: 0.62,
  });

  const bottomText = getRegionText(lines, {
    minTop: 0.72,
  });

  const sources = [
    {
      source: "bottom-left" as const,
      rawText: bottomLeftText,
      score: 100,
    },
    {
      source: "bottom" as const,
      rawText: bottomText,
      score: 65,
    },
    {
      source: "global" as const,
      rawText: result.text,
      score: 35,
    },
  ];

  for (const source of sources) {
    if (!source.rawText) {
      continue;
    }

    const collectorInput = findCollectorInputFromText(source.rawText);

    if (collectorInput.setCode || collectorInput.number) {
      candidates.push({
        ...collectorInput,
        score: source.score,
        source: source.source,
        rawText: source.rawText,
      });
    }
  }

  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.setCode ?? ""}-${candidate.number ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function scoreNameLine(line: PositionedTextLine): OcrNameCandidate | undefined {
  const cleanedText = cleanNameLine(normalizeOcrText(line.text));

  if (!isLikelyNameLine(cleanedText)) {
    return undefined;
  }

  let score = 0;
  let source: OcrNameCandidate["source"] = "global";

  score += 20;

  if (line.top >= 0.35 && line.top <= 0.68) {
    score += 35;
    source = "name-band";
  } else if (line.top >= 0.25 && line.top <= 0.76) {
    score += 15;
  }

  if (/\brune\b/i.test(cleanedText) && line.top >= 0.25 && line.top <= 0.75) {
    score += 25;
    source = "rune-center";
  }

  if (line.width >= 0.2) {
    score += 8;
  }

  if (cleanedText.length >= 3 && cleanedText.length <= 40) {
    score += 8;
  }

  if (line.top > 0.72) {
    score -= 30;
  }

  if (looksLikeTypeOrTagLine(cleanedText)) {
    score -= 60;
  }

  return {
    text: line.text,
    cleanedText,
    score,
    source,
    line,
  };
}

function getNameCandidatesFromRecognition(
  result: TextRecognitionResult,
): OcrNameCandidate[] {
  const positionedCandidates = getPositionedTextLines(result)
    .map(scoreNameLine)
    .filter((candidate): candidate is OcrNameCandidate => Boolean(candidate))
    .filter((candidate) => candidate.score >= 20);

  const globalCandidates = getGlobalNameCandidates(result.text);

  const combinedCandidates = getCombinedTitleCandidates([
    ...positionedCandidates,
    ...globalCandidates,
  ]);

  const seen = new Set<string>();

  return [...combinedCandidates, ...positionedCandidates, ...globalCandidates]
    .filter((candidate) => {
      const key = candidate.cleanedText.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => right.score - left.score);
}

function resolveOcrNameFromKnownCards(
  candidates: OcrNameCandidate[],
): string | undefined {
  const cards = getCardexCards();
  let bestMatch:
    | {
        name: string;
        score: number;
      }
    | undefined;

  for (const candidate of candidates) {
    const candidateName = normalizeScanText(candidate.cleanedText);

    if (!candidateName) {
      continue;
    }

    for (const card of cards) {
      const cardName = normalizeScanText(card.name);

      if (!cardName) {
        continue;
      }

      let similarity = getStringSimilarity(candidateName, cardName);

      if (candidateName === cardName) {
        similarity = 1;
      } else if (
        candidateName.includes(cardName) ||
        cardName.includes(candidateName)
      ) {
        similarity = Math.max(similarity, 0.88);
      }

      const score = similarity * 100 + candidate.score * 0.2;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          name: card.name,
          score,
        };
      }
    }
  }

  if (!bestMatch || bestMatch.score < 78) {
    return undefined;
  }

  return bestMatch.name;
}

export function parseCardText(text: string): CardScanInput {
  const normalizedText = normalizeOcrText(text);
  const collectorInput = findCollectorInputFromText(normalizedText);
  const firstLine = getFirstUsefulLine(normalizedText);
  const name = firstLine ? cleanNameLine(firstLine) : undefined;
  const input: CardScanInput = {};

  if (name) {
    input.name = name;
  }

  if (collectorInput.setCode) {
    input.setCode = collectorInput.setCode;
  }

  if (collectorInput.number) {
    input.number = collectorInput.number;
  }

  return input;
}

export function parseCardRecognition(
  result: TextRecognitionResult,
): CardOcrParseResult {
  const nameCandidates = getNameCandidatesFromRecognition(result);
  const collectorCandidates = getCollectorCandidatesFromRecognition(result);

  const resolvedName = resolveOcrNameFromKnownCards(nameCandidates);
  const bestNameCandidate = nameCandidates[0];
  const bestCollectorCandidate = collectorCandidates[0];

  const input: CardScanInput = {};

  if (resolvedName) {
    input.name = resolvedName;
  } else if (bestNameCandidate?.cleanedText) {
    input.name = bestNameCandidate.cleanedText;
  }

  if (bestCollectorCandidate?.setCode) {
    input.setCode = bestCollectorCandidate.setCode;
  }

  if (bestCollectorCandidate?.number) {
    input.number = bestCollectorCandidate.number;
  }

  return {
    input,
    nameCandidates,
    collectorCandidates,
  };
}

function getLineBottom(line: TextLine) {
  if (!line.frame) {
    return 0;
  }

  return line.frame.top + line.frame.height;
}

function getBottomRegionText(result: TextRecognitionResult) {
  const lines = result.blocks
    .flatMap((block) => block.lines)
    .filter((line) => line.text.trim());

  if (lines.length === 0) {
    return "";
  }

  const lowestBottom = Math.max(...lines.map(getLineBottom));
  const bottomCutoff = lowestBottom * 0.68;
  const bottomLines = lines
    .filter((line) => {
      if (!line.frame) {
        return false;
      }

      return getLineBottom(line) >= bottomCutoff;
    })
    .sort((a, b) => getLineBottom(a) - getLineBottom(b));

  return bottomLines
    .flatMap((line) => [
      line.text,
      ...line.elements.map((element) => element.text),
    ])
    .join(" ");
}

function scoreRarityText(text: string) {
  const normalizedText = ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")} `;

  const scores: Partial<Record<RarityHint["rarity"], number>> = {};

  function addScore(rarity: RarityHint["rarity"], score: number) {
    scores[rarity] = (scores[rarity] ?? 0) + score;
  }

  if (/\bcommon\b/.test(normalizedText)) addScore("Common", 6);
  if (/\buncommon\b/.test(normalizedText)) addScore("Uncommon", 6);
  if (/\brare\b/.test(normalizedText)) addScore("Rare", 6);
  if (/\bepic\b/.test(normalizedText)) addScore("Epic", 6);
  if (/\bshowcase\b/.test(normalizedText)) addScore("Showcase", 6);
  if (/\bpromo\b/.test(normalizedText)) addScore("Promo", 6);

  if (/[○●◯]/.test(normalizedText)) addScore("Common", 1);
  if (/[△▲▽▴▵]/.test(normalizedText)) addScore("Uncommon", 1);
  if (/[◇◆◊]/.test(normalizedText)) addScore("Rare", 1);
  if (/[⬟⬠]/.test(normalizedText)) addScore("Epic", 1);
  if (/[⬢⬣⬡]/.test(normalizedText)) addScore("Showcase", 1);
  if (/[★☆✦✧✶*]/.test(normalizedText)) {
    addScore("Epic", 1);
    addScore("Showcase", 1);
  }

  return scores;
}

export function detectRarityHintFromRecognition(
  result: TextRecognitionResult,
): RarityHint | undefined {
  const sourceText = getBottomRegionText(result);

  if (!sourceText) {
    return undefined;
  }

  const scores = scoreRarityText(sourceText);
  const sortedMatches = Object.entries(scores).sort(
    ([, leftScore], [, rightScore]) => rightScore - leftScore,
  ) as Array<[RarityHint["rarity"], number]>;

  const bestMatch = sortedMatches.at(0);
  const secondBestScore = sortedMatches.at(1)?.[1] ?? 0;

  if (!bestMatch || bestMatch[1] <= 0 || bestMatch[1] === secondBestScore) {
    return undefined;
  }

  return {
    rarity: bestMatch[0],
    confidence: Math.min(1, bestMatch[1] / 6),
    sourceText,
  };
}

export async function recognizeTextFromPhoto(photoUri: string) {
  const { default: TextRecognition } =
    await import("@react-native-ml-kit/text-recognition");

  return TextRecognition.recognize(photoUri);
}

export async function scanCardTextFromPhoto(
  photoUri: string,
): Promise<ScanOcrResult> {
  const result = await recognizeTextFromPhoto(photoUri);

  const nameCrop = await cropScanImage(photoUri, "name-band");
  const collectorCrop = await cropScanImage(photoUri, "collector-bottom");

  const [nameCropResult, collectorCropResult] = await Promise.all([
    recognizeTextFromPhoto(nameCrop.uri).catch(() => undefined),
    recognizeTextFromPhoto(collectorCrop.uri).catch(() => undefined),
  ]);

  const parsedRecognition = parseCardRecognition(result);

  if (SCAN_OCR_DEBUG) {
    console.log("OCR raw text:", result.text);
    console.log("[OCR CROP] name-band text:", nameCropResult?.text);
    console.log("[OCR CROP] collector-bottom text:", collectorCropResult?.text);
    console.log("[OCR CROP] debug uris:", {
      nameBand: nameCrop.uri,
      collectorBottom: collectorCrop.uri,
    });
    console.log("OCR parsed input:", parsedRecognition.input);
    console.log("OCR name candidates:", parsedRecognition.nameCandidates);
    console.log(
      "[OCR] name candidates:",
      parsedRecognition.nameCandidates.map((candidate) => ({
        text: candidate.cleanedText,
        score: candidate.score,
        source: candidate.source,
        top: candidate.line?.top,
        left: candidate.line?.left,
        width: candidate.line?.width,
      })),
    );
    console.log("[OCR] resolved input:", parsedRecognition.input);
  }

  return {
    rawText: result.text,
    input: parsedRecognition.input,
    rarityHint: detectRarityHintFromRecognition(result),
    nameCandidates: parsedRecognition.nameCandidates,
    collectorCandidates: parsedRecognition.collectorCandidates,
  };
}

export async function readCardOcr(photoUri: string): Promise<ScanOcrResult> {
  return scanCardTextFromPhoto(photoUri);
}
