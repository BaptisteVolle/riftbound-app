import { CardScanInput } from '../cards/cards.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import type { TextLine, TextRecognitionResult } from '@react-native-ml-kit/text-recognition';

const SET_CODES = ['JDG', 'OGN', 'OGNX', 'OGS', 'OPP', 'PR', 'PROK', 'SFD', 'SFDX', 'UNL'];
const SET_CODE_PATTERN = SET_CODES.join('|');
const CARD_NAME_SUFFIXES = /\s+(\(?(Alternate Art|Overnumbered|Signature|Metal)\)?)$/i;
const RARITY_LABELS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Promo'] as const;
const TYPE_LABEL_PATTERN = /^(champion|unit|spell|rune|gear|battlefield|legend)\b/i;

export type RarityHint = {
  rarity: (typeof RARITY_LABELS)[number];
  confidence: number;
  sourceText: string;
};

function normalizeOcrText(text: string) {
  return text
    .replace(/[|]/g, 'I')
    .replace(/\u2022/g, '*')
    .replace(/\u00b7/g, '*')
    .replace(/[Oo](?=\s*\/\s*\d{2,3})/g, '0')
    .replace(/[Il](?=\s*\/\s*\d{2,3})/g, '1')
    .replace(/[\u2010-\u2015]/g, '-');
}

function getTextLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function containsSetCode(text: string) {
  return SET_CODES.some((setCode) => new RegExp(`\\b${setCode}\\b`, 'i').test(text));
}

function cleanNameLine(line: string) {
  return line
    .replace(CARD_NAME_SUFFIXES, '')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/\s+/g, ' ')
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

  if (TYPE_LABEL_PATTERN.test(cleanedLine)) {
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

function normalizeParsedNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.toUpperCase();
  const [, digits = normalizedValue, suffix = ''] =
    normalizedValue.match(/^([0-9OIL]{1,3})([A-Z*]?)$/) ?? [];
  const correctedDigits = digits.replace(/[O]/g, '0').replace(/[IL]/g, '1');

  return normalizeCollectorNumber(`${correctedDigits}${suffix}`);
}

function findCollectorInput(text: string): Pick<CardScanInput, 'setCode' | 'number'> {
  const setRegex = new RegExp(`\\b(${SET_CODE_PATTERN})\\b`, 'i');
  const setNumberRegex = new RegExp(
    `\\b(${SET_CODE_PATTERN})\\s*[-#:*·]?\\s*([0-9OIl]{1,3}[A-Za-z*]?)(?:\\s*\\/\\s*[0-9]{2,3})?\\b`,
    'i',
  );
  const numberSlashRegex = /\b([0-9OIl]{1,3}[A-Za-z*]?)\s*\/\s*[0-9]{2,3}\b/i;
  const setNumberMatch = text.match(setNumberRegex);

  if (setNumberMatch) {
    return {
      setCode: setNumberMatch[1].toUpperCase(),
      number: normalizeParsedNumber(setNumberMatch[2]),
    };
  }

  return {
    setCode: text.match(setRegex)?.[1]?.toUpperCase(),
    number: normalizeParsedNumber(text.match(numberSlashRegex)?.[1]),
  };
}

function getLineBottom(line: TextLine) {
  if (!line.frame) {
    return 0;
  }

  return line.frame.top + line.frame.height;
}

function getBottomRegionText(result: TextRecognitionResult) {
  const lines = result.blocks.flatMap((block) => block.lines).filter((line) => line.text.trim());

  if (lines.length === 0) {
    return '';
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
    .flatMap((line) => [line.text, ...line.elements.map((element) => element.text)])
    .join(' ');
}

function scoreRarityText(text: string) {
  const normalizedText = ` ${text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')} `;

  const scores: Partial<Record<RarityHint['rarity'], number>> = {};

  function addScore(rarity: RarityHint['rarity'], score: number) {
    scores[rarity] = (scores[rarity] ?? 0) + score;
  }

  if (/\bcommon\b/.test(normalizedText)) addScore('Common', 6);
  if (/\buncommon\b/.test(normalizedText)) addScore('Uncommon', 6);
  if (/\brare\b/.test(normalizedText)) addScore('Rare', 6);
  if (/\bepic\b/.test(normalizedText)) addScore('Epic', 6);
  if (/\bshowcase\b/.test(normalizedText)) addScore('Showcase', 6);
  if (/\bpromo\b/.test(normalizedText)) addScore('Promo', 6);

  if (/[○●◯]/.test(normalizedText)) addScore('Common', 1);
  if (/[△▲▽▴▵]/.test(normalizedText)) addScore('Uncommon', 1);
  if (/[◇◆◊]/.test(normalizedText)) addScore('Rare', 1);
  if (/[⬟⬠]/.test(normalizedText)) addScore('Epic', 1);
  if (/[⬢⬣⬡]/.test(normalizedText)) addScore('Showcase', 1);
  if (/[★☆✦✧✶*]/.test(normalizedText)) {
    addScore('Epic', 1);
    addScore('Showcase', 1);
  }

  return scores;
}

export function detectRarityHintFromRecognition(result: TextRecognitionResult): RarityHint | undefined {
  const sourceText = getBottomRegionText(result);

  if (!sourceText) {
    return undefined;
  }

  const scores = scoreRarityText(sourceText);
  const sortedMatches = Object.entries(scores).sort(
    ([, leftScore], [, rightScore]) => rightScore - leftScore,
  ) as Array<[RarityHint['rarity'], number]>;
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

export function parseCardText(text: string): CardScanInput {
  const normalizedText = normalizeOcrText(text);
  const collectorInput = findCollectorInput(normalizedText);
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

export async function recognizeTextFromPhoto(photoUri: string) {
  const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
  return TextRecognition.recognize(photoUri);
}

export async function scanCardTextFromPhoto(photoUri: string) {
  const result = await recognizeTextFromPhoto(photoUri);
  return {
    rawText: result.text,
    input: parseCardText(result.text),
    rarityHint: detectRarityHintFromRecognition(result),
  };
}
