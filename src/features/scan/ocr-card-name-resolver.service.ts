import { getCardexCards } from "../cards/cards.service";
import { normalizeScanText } from "./scan-match.service";
import { getStringSimilarity } from "../../lib/string-similarity";
import type { OcrNameCandidate } from "./ocr-parser.service";

export type ResolvedOcrName = {
  name: string;
  score: number;
  sourceText: string;
  matchedCardName: string;
};

export function resolveOcrNameFromKnownCards(
  candidates: OcrNameCandidate[],
): ResolvedOcrName | undefined {
  const cards = getCardexCards();
  let bestMatch: ResolvedOcrName | undefined;

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
          sourceText: candidate.cleanedText,
          matchedCardName: card.name,
        };
      }
    }
  }

  if (!bestMatch) {
    return undefined;
  }

  // Seuil volontairement assez haut pour éviter les hallucinations.
  if (bestMatch.score < 78) {
    return undefined;
  }

  return bestMatch;
}
