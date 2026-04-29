import { CardScanInput, RiftboundCard } from './cards.types';
import {
  findCardmarketOverride,
  getCardmarketProducts,
} from '../cardmarket/cardmarket.service';
import { CardmarketOverride } from '../cardmarket/cardmarket.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';

const CARDMARKET_BASE_URL = 'https://www.cardmarket.com';
const cardmarketUrlReachabilityCache = new Map<string, boolean>();

const SET_LABELS: Record<string, string> = {
  JDG: 'Origins: Promos',
  OGN: 'Origins',
  OGNX: 'Origins: Promos',
  OGS: 'Proving Grounds',
  OPP: 'Origins: Promos',
  PR: 'Project K Promos',
  PROK: 'Project K Promos',
  SFD: 'Spiritforged',
  SFDX: 'Spiritforged: Promos',
  UNL: 'Unleashed',
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\brek sai\b/g, 'reksai')
    .trim();
}

function buildCardmarketUrlFromPath(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${CARDMARKET_BASE_URL}${pathOrUrl}`;
}

function getCardmarketSearchName(name: string) {
  return name
    .replace(/\s+\((Alternate Art|Overnumbered|Signature|Metal)\)$/i, '')
    .replace(/\s+(Alternate Art|Overnumbered|Signature|Metal)$/i, '')
    .trim();
}

function getCandidateNameBase(name: string) {
  return normalize(
    getCardmarketSearchName(name)
      .replace(/\s+Alternate Art$/i, '')
      .replace(/\s+Overnumbered$/i, '')
      .replace(/\s+Signature$/i, '')
      .replace(/\s+Metal$/i, ''),
  );
}

function getPrimaryNameToken(name: string) {
  return getCandidateNameBase(name).split(' ')[0] ?? '';
}

function getNameTokenOverlapScore(left: string, right: string) {
  const leftTokens = new Set(normalize(left).split(' ').filter((token) => token.length > 1));
  const rightTokens = normalize(right).split(' ').filter((token) => token.length > 1);

  return rightTokens.filter((token) => leftTokens.has(token)).length;
}

function getLocalCardId(product: CardmarketOverride) {
  const number = normalizeCollectorNumber(product.number || '000');
  const nameKey = normalize(product.name).replace(/\s+/g, '-');
  return `${product.setCode.toLowerCase()}-${number.toLowerCase()}-${nameKey}`;
}

function normalizeProductName(name: string) {
  return name
    .replace(/\s+Alternate Art$/i, ' (Alternate Art)')
    .replace(/\s+Overnumbered$/i, ' (Overnumbered)')
    .replace(/\s+Signature$/i, ' (Signature)')
    .replace(/\s+Metal$/i, ' (Metal)');
}

function productToCard(product: CardmarketOverride): RiftboundCard {
  return {
    id: getLocalCardId(product),
    externalId: product.riftboundId,
    name: normalizeProductName(product.name),
    set: SET_LABELS[product.setCode] ?? product.setCode,
    setCode: product.setCode,
    number: normalizeCollectorNumber(product.number),
    color: product.rarity ?? 'Unknown',
    cost: 0,
    type: product.type ?? 'Card',
    imageUrl: product.imageUrl,
    rarity: product.rarity,
    alternateArt: product.notes?.includes('alternate_art'),
    overnumbered: product.notes?.includes('overnumbered'),
    signature: product.notes?.includes('signature'),
  };
}

const localCardMap = new Map<string, RiftboundCard>();

getCardmarketProducts().forEach((product) => {
  const id = getLocalCardId(product);

  if (!localCardMap.has(id)) {
    localCardMap.set(id, productToCard(product));
  }
});

const localCards = [...localCardMap.values()].sort((a, b) => {
  return (
    a.setCode.localeCompare(b.setCode) ||
    a.name.localeCompare(b.name) ||
    normalizeCollectorNumber(a.number).localeCompare(normalizeCollectorNumber(b.number))
  );
});

export function getAllCards() {
  return localCards;
}

export function getCardById(id: string) {
  return localCards.find((card) => card.id === id);
}

export function searchCards(query: string) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return localCards;
  }

  return localCards.filter((card) => {
    const haystack = normalize(
      `${card.name} ${card.set} ${card.setCode} ${card.number} ${card.color} ${card.type}`,
    );
    return haystack.includes(normalizedQuery);
  });
}

export function findCardFromScan(input: CardScanInput): RiftboundCard | undefined {
  const normalizedName = input.name ? normalize(input.name) : '';
  const normalizedSetCode = input.setCode?.toUpperCase();
  const normalizedNumber = input.number ? normalizeCollectorNumber(input.number) : '';

  if (normalizedSetCode && normalizedNumber) {
    const exactCollectorMatches = localCards.filter(
      (card) =>
        card.setCode === normalizedSetCode &&
        normalizeCollectorNumber(card.number) === normalizedNumber,
    );
    const nameMatchedCollectorCard = normalizedName
      ? exactCollectorMatches
          .map((card) => {
            const cardName = normalize(card.name);
            const score =
              cardName === normalizedName
                ? 100
                : cardName.includes(normalizedName) || normalizedName.includes(cardName)
                  ? 75
                  : getNameTokenOverlapScore(card.name, normalizedName) * 12;

            return { card, score };
          })
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)[0]?.card
      : undefined;
    const exactCollectorMatch = nameMatchedCollectorCard ?? exactCollectorMatches[0];

    if (exactCollectorMatch) {
      return exactCollectorMatch;
    }
  }

  return localCards.find((card) => {
    const nameMatches = normalizedName ? normalize(card.name).includes(normalizedName) : true;
    const setMatches = normalizedSetCode ? card.setCode === normalizedSetCode : true;
    const numberMatches = normalizedNumber
      ? normalizeCollectorNumber(card.number) === normalizedNumber
      : true;
    return nameMatches && setMatches && numberMatches;
  });
}

export function getLikelyCardCandidates(input: CardScanInput, seedCard?: RiftboundCard, limit = 12) {
  const targetName = input.name ? getCandidateNameBase(input.name) : '';
  const targetNameToken = getPrimaryNameToken(input.name ?? '');
  const targetSetCode = input.setCode?.trim().toUpperCase();
  const targetNumber = input.number ? normalizeCollectorNumber(input.number) : '';
  const seedName = seedCard ? getCandidateNameBase(seedCard.name) : '';
  const seedNameToken = getPrimaryNameToken(seedCard?.name ?? '');

  const scoredCards = localCards
    .map((card) => {
      const cardName = getCandidateNameBase(card.name);
      const cardNameToken = getPrimaryNameToken(card.name);
      let score = 0;

      if (seedCard?.id === card.id) {
        score += 100;
      }

      if (targetSetCode && card.setCode === targetSetCode) {
        score += 12;
      }

      if (targetNumber && normalizeCollectorNumber(card.number) === targetNumber) {
        score += 20;
      }

      if (targetName && cardName === targetName) {
        score += 70;
      } else if (targetName && (cardName.includes(targetName) || targetName.includes(cardName))) {
        score += 50;
      } else if (targetName) {
        score += getNameTokenOverlapScore(card.name, targetName) * 12;
      }

      if (seedName && cardName === seedName) {
        score += 60;
      } else if (seedName && (cardName.includes(seedName) || seedName.includes(cardName))) {
        score += 45;
      } else if (seedName) {
        score += getNameTokenOverlapScore(card.name, seedName) * 10;
      }

      if (targetNameToken && cardNameToken === targetNameToken) {
        score += 25;
      }

      if (seedNameToken && cardNameToken === seedNameToken) {
        score += 20;
      }

      if (card.imageUrl) {
        score += 3;
      }

      return { card, score };
    })
    .filter(({ score }) => score >= 35)
    .sort((a, b) => {
      return (
        b.score - a.score ||
        a.card.setCode.localeCompare(b.card.setCode) ||
        normalizeCollectorNumber(a.card.number).localeCompare(normalizeCollectorNumber(b.card.number))
      );
    })
    .slice(0, limit);

  return scoredCards.map(({ card }) => card);
}

export function buildCardmarketSearchUrl(input: CardScanInput) {
  const searchQuery = input.name ? getCardmarketSearchName(input.name) : '';

  if (!searchQuery) {
    return undefined;
  }

  return `${CARDMARKET_BASE_URL}/en/Riftbound/Products/Search?searchString=${encodeURIComponent(
    searchQuery,
  )}`;
}

export function buildCardmarketUrlForCard(card: RiftboundCard) {
  const override = findCardmarketOverride(card);

  if (override) {
    return buildCardmarketUrlFromPath(override.cardmarketPath);
  }

  return undefined;
}

async function canReachCardmarketUrl(url: string) {
  const cachedResult = cardmarketUrlReachabilityCache.get(url);

  if (cachedResult !== undefined) {
    return cachedResult;
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
    });
    const isReachable = response.status !== 404;

    cardmarketUrlReachabilityCache.set(url, isReachable);
    return isReachable;
  } catch {
    return true;
  }
}

export async function getOpenableCardmarketUrlForCard(card: RiftboundCard) {
  const directUrl = buildCardmarketUrlForCard(card);
  const searchUrl = buildCardmarketSearchUrl({ name: card.name });

  if (!directUrl) {
    return {
      mode: searchUrl ? 'search' : 'none',
      url: searchUrl,
    } as const;
  }

  const canReachDirectUrl = await canReachCardmarketUrl(directUrl);

  if (!canReachDirectUrl && searchUrl) {
    return {
      mode: 'search',
      url: searchUrl,
    } as const;
  }

  return {
    mode: 'direct',
    url: directUrl,
  } as const;
}
