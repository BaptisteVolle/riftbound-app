import { RiftboundCard } from '../cards/cards.types';
import { CardScanInput } from '../cards/cards.types';
import { RiftCodexCard, RiftCodexCardsResponse } from './riftcodex.types';

const RIFTCODEX_CARDS_URL = 'https://api.riftcodex.com/cards';

function getSetCode(card: RiftCodexCard) {
  return (card.set?.set_id ?? card.set?.id ?? '').toUpperCase();
}

function normalizeSetCode(value?: string) {
  const normalized = value?.trim().toUpperCase() ?? '';

  if (['SF', 'SPIRIT', 'SPIRITFORGED'].includes(normalized)) {
    return 'SFD';
  }

  if (['ORIGIN', 'ORIGINS', 'OCN'].includes(normalized)) {
    return 'OGN';
  }

  if (['UNLEASHED'].includes(normalized)) {
    return 'UNL';
  }

  return normalized;
}

function getPrintedNumber(card: RiftCodexCard) {
  const [, printedNumber] = card.riftbound_id?.match(/^[a-z]+-([^-]+)/i) ?? [];

  if (printedNumber) {
    return printedNumber.toUpperCase();
  }

  return String(card.collector_number ?? '').padStart(3, '0');
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeCollectorNumber(value: string) {
  const firstPart = value.trim().split('/')[0]?.trim() ?? '';
  const normalized = firstPart.replace(/[^a-zA-Z0-9*]/g, '').toUpperCase();

  if (/^\d{1,2}\*?$/.test(normalized)) {
    return normalized.padStart(normalized.endsWith('*') ? 4 : 3, '0');
  }

  return normalized;
}

function collectorNumberMatches(card: RiftCodexCard, targetNumber: string) {
  const cardNumber = normalizeCollectorNumber(getPrintedNumber(card));

  if (cardNumber === targetNumber) {
    return true;
  }

  if (!targetNumber.endsWith('*')) {
    return false;
  }

  const baseTargetNumber = targetNumber.slice(0, -1);
  return cardNumber === baseTargetNumber && Boolean(card.metadata?.overnumbered);
}

function nameMatches(card: RiftCodexCard, targetName: string) {
  const cardName = normalizeText(card.name);
  const cleanName = normalizeText(card.metadata?.clean_name ?? card.name);
  return cardName.includes(targetName) || cleanName.includes(targetName);
}

function scoreNameCandidate(card: RiftCodexCard, input: {
  targetName: string;
  targetNumber: string;
  targetSetCode: string;
}) {
  const cardName = normalizeText(card.name);
  const cleanName = normalizeText(card.metadata?.clean_name ?? card.name);
  let score = 0;

  if (cleanName === input.targetName || cardName === input.targetName) {
    score += 100;
  } else if (nameMatches(card, input.targetName)) {
    score += 60;
  }

  if (input.targetSetCode && getSetCode(card) === input.targetSetCode) {
    score += 20;
  }

  if (input.targetNumber && collectorNumberMatches(card, input.targetNumber)) {
    score += 10;
  }

  return score;
}

export function mapRiftCodexCard(
  card: RiftCodexCard,
  matchConfidence: RiftboundCard['matchConfidence'] = 'exact',
): RiftboundCard {
  const domain = card.classification?.domain?.[0] ?? card.classification?.rarity ?? 'Unknown';

  return {
    id: `riftcodex-${card.id}`,
    externalId: card.id,
    name: card.name,
    set: card.set?.label ?? getSetCode(card),
    setCode: getSetCode(card),
    number: getPrintedNumber(card),
    color: domain,
    cost: card.attributes?.energy ?? 0,
    type: card.classification?.type ?? 'Card',
    imageUrl: card.media?.image_url,
    rarity: card.classification?.rarity ?? undefined,
    alternateArt: card.metadata?.alternate_art,
    overnumbered: card.metadata?.overnumbered,
    signature: card.metadata?.signature,
    matchConfidence,
  };
}

export async function fetchRiftCodexCards(query = '', limit = 40) {
  const params = new URLSearchParams({
    limit: String(limit),
    page: '1',
  });

  if (query.trim()) {
    params.set('name', query.trim());
  }

  const response = await fetch(`${RIFTCODEX_CARDS_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`RiftCodex request failed with ${response.status}`);
  }

  const data = (await response.json()) as RiftCodexCardsResponse;
  return (data.items ?? []).map((card) => mapRiftCodexCard(card));
}

async function fetchRiftCodexPage(page: number, limit = 50, setCode?: string) {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
  });

  if (setCode) {
    params.set('set_id', setCode.toLowerCase());
  }

  const response = await fetch(`${RIFTCODEX_CARDS_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`RiftCodex request failed with ${response.status}`);
  }

  const data = (await response.json()) as RiftCodexCardsResponse;
  return data.items ?? [];
}

async function fetchRiftCodexCardsByName(query: string, limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit),
    page: '1',
    name: query.trim(),
  });

  const response = await fetch(`${RIFTCODEX_CARDS_URL}?${params.toString()}`);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as RiftCodexCardsResponse;
  return data.items ?? [];
}

async function fetchRiftCodexCardByPrintedId(setCode: string, number: string) {
  const response = await fetch(
    `${RIFTCODEX_CARDS_URL}/riftbound/${setCode.toLowerCase()}-${number.toLowerCase()}`,
  );

  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as RiftCodexCard[];
  return data[0];
}

export async function findRiftCodexCardFromScan(input: CardScanInput) {
  const targetSetCode = normalizeSetCode(input.setCode);
  const targetNumber = input.number ? normalizeCollectorNumber(input.number) : '';
  const targetName = input.name ? normalizeText(input.name) : '';

  if (!targetSetCode && !targetNumber && !targetName) {
    return undefined;
  }

  if (targetName) {
    const nameCandidates = await fetchRiftCodexCardsByName(input.name ?? '', 80);
    const filteredNameCandidates = nameCandidates.filter((card) => {
      const setMatches = targetSetCode ? getSetCode(card) === targetSetCode : true;
      return setMatches && nameMatches(card, targetName);
    });
    const exactNameCandidates = filteredNameCandidates.filter((card) => {
      const cardName = normalizeText(card.name);
      const cleanName = normalizeText(card.metadata?.clean_name ?? card.name);
      return cardName === targetName || cleanName === targetName;
    });
    const exactCollectorCandidate = filteredNameCandidates.find((card) => {
      const setMatches = targetSetCode ? getSetCode(card) === targetSetCode : true;
      const numberMatches = targetNumber ? collectorNumberMatches(card, targetNumber) : false;

      return setMatches && numberMatches;
    });

    if (exactCollectorCandidate) {
      return mapRiftCodexCard(exactCollectorCandidate, 'exact');
    }

    const bestNameMatch = filteredNameCandidates
      .map((card) => ({
        card,
        score: scoreNameCandidate(card, {
          targetName,
          targetNumber,
          targetSetCode,
        }),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (bestNameMatch?.score >= 60) {
      const collectorMatches = targetNumber
        ? collectorNumberMatches(bestNameMatch.card, targetNumber)
        : false;
      const confidence =
        collectorMatches || exactNameCandidates.length === 1 ? 'exact' : 'name-only';

      return mapRiftCodexCard(bestNameMatch.card, confidence);
    }
  }

  if (!targetName && targetSetCode && targetNumber) {
    const directMatch = await fetchRiftCodexCardByPrintedId(targetSetCode, targetNumber);

    if (directMatch) {
      return mapRiftCodexCard(directMatch, 'collector-only');
    }
  }

  const maxPages = targetSetCode ? 8 : 20;
  let fallbackCollectorMatch: RiftCodexCard | undefined;

  for (let page = 1; page <= maxPages; page += 1) {
    const pageCards = await fetchRiftCodexPage(page, 50, targetSetCode);

    if (pageCards.length === 0) {
      return undefined;
    }

    const exactCollectorMatch = pageCards.find((card) => {
      const setMatches = targetSetCode ? getSetCode(card) === targetSetCode : true;
      const numberMatches = targetNumber ? collectorNumberMatches(card, targetNumber) : true;

      return setMatches && numberMatches;
    });

    if (exactCollectorMatch && (targetSetCode || targetNumber)) {
      if (!targetName) {
        return mapRiftCodexCard(exactCollectorMatch, 'collector-only');
      }

      fallbackCollectorMatch ??= exactCollectorMatch;
    }

    const nameMatch = pageCards.find((card) => {
      if (!targetName) {
        return false;
      }

      const cardName = normalizeText(card.name);
      const setMatches = targetSetCode ? getSetCode(card) === targetSetCode : true;
      return setMatches && cardName.includes(targetName);
    });

    if (nameMatch) {
      const exactCollectorMatchForName = targetNumber
        ? collectorNumberMatches(nameMatch, targetNumber)
        : false;
      const exactSetMatchForName = targetSetCode ? getSetCode(nameMatch) === targetSetCode : true;

      return mapRiftCodexCard(
        nameMatch,
        exactCollectorMatchForName && exactSetMatchForName ? 'exact' : 'name-only',
      );
    }
  }

  if (fallbackCollectorMatch) {
    return mapRiftCodexCard(fallbackCollectorMatch, 'collector-only');
  }

  return undefined;
}
