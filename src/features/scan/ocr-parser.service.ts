// src/features/scan/ocr-parser.service.ts

import type { TextRecognitionResult } from "@react-native-ml-kit/text-recognition";

import type { CardScanInput } from "../cards/cards.types";
import { normalizeCollectorNumber } from "../riftcodex/riftcodex.service";
import {
  getPositionedTextLines,
  getRegionText,
  type PositionedTextLine,
} from "./ocr-layout.service";

import { resolveOcrNameFromKnownCards } from "./ocr-card-name-resolver.service";

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

  // Exemple : "CHAMPION UNIT DARIUS NOXUS TRIFARIAN"
  if (cardTypeCount >= 1 && words.length >= 4) {
    return true;
  }

  // Les lignes de type/tags sont souvent en uppercase et très segmentées.
  const uppercaseLetters = value.replace(/[^A-Z]/g, "").length;
  const lowercaseLetters = value.replace(/[^a-z]/g, "").length;
  const isMostlyUppercase = uppercaseLetters > lowercaseLetters * 2;

  if (isMostlyUppercase && /[•·*|-]/.test(value) && words.length >= 3) {
    return true;
  }

  return false;
}

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

export function normalizeOcrText(text: string) {
  return text
    .replace(/[|]/g, "I")
    .replace(/\u2022/g, "*")
    .replace(/\u00b7/g, "*")
    .replace(/[Oo](?=\s*\/\s*\d{2,3})/g, "0")
    .replace(/[Il](?=\s*\/\s*\d{2,3})/g, "1")
    .replace(/[\u2010-\u2015]/g, "-");
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

  // Ligne composée uniquement de chiffres / symboles
  if (/^[0-9+\-\s/*]+$/.test(cleanedLine)) {
    return false;
  }

  // Ligne collector type "OGN 042a/298"
  if (containsSetCode(cleanedLine)) {
    return false;
  }

  if (/\b[0-9OIl]{1,3}[A-Za-z*]?\s*\/\s*[0-9]{2,3}\b/i.test(cleanedLine)) {
    return false;
  }

  // Rareté seule
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

  // Zone la plus fréquente du bandeau de nom.
  if (line.top >= 0.35 && line.top <= 0.68) {
    score += 35;
    source = "name-band";
  } else if (line.top >= 0.25 && line.top <= 0.76) {
    score += 15;
  }

  // Les runes ont souvent le nom au centre avec "Rune".
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

  // Trop bas = souvent texte de règle / flavor / illustrateur.
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

  if (resolvedName?.name) {
    input.name = resolvedName.name;
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
