import { RiftboundCard } from '../cards/cards.types';
import { CardScanInput } from '../cards/cards.types';
import { RiftCodexCard, RiftCodexCardsResponse } from './riftcodex.types';

const RIFTCODEX_CARDS_URL = 'https://api.riftcodex.com/cards';

function getSetCode(card: RiftCodexCard) {
  return (card.set?.set_id ?? card.set?.id ?? '').toUpperCase();
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
  const normalized = firstPart.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (/^\d{1,2}$/.test(normalized)) {
    return normalized.padStart(3, '0');
  }

  return normalized;
}

function getCardmarketPath(name: string) {
  const slug = name
    .replace(/\s+\(Alternate Art\)$/i, '')
    .replace(/\s+\(Overnumbered\)$/i, '')
    .replace(/\s+\(Signature\)$/i, '')
    .replace(/\s+\(Metal\)$/i, '')
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `/en/Riftbound/Cards/${slug}`;
}

function getCardmarketExpansionPath(card: RiftCodexCard) {
  const setCode = getSetCode(card);
  const label = card.set?.label ?? '';

  if (setCode === 'OGN') {
    return 'Origins';
  }

  if (setCode === 'UNL') {
    return 'Unleashed';
  }

  if (setCode === 'SFD') {
    return 'Spiritforged';
  }

  if (setCode === 'OPP' || label.toLowerCase().includes('promo')) {
    return 'Origins-Promos';
  }

  return label
    .replace(/[:]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getCardmarketProductSlug(card: RiftCodexCard) {
  const baseSlug = card.name
    .replace(/\s+\(Alternate Art\)$/i, '')
    .replace(/\s+\(Overnumbered\)$/i, '')
    .replace(/\s+\(Signature\)$/i, '')
    .replace(/\s+\(Metal\)$/i, '')
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (card.metadata?.signature) {
    return `${baseSlug}-V3-Overnumbered`;
  }

  if (card.metadata?.overnumbered) {
    return `${baseSlug}-V2-Overnumbered`;
  }

  if (card.name.includes("Kai'Sa - Daughter of the Void") && card.classification?.rarity === 'Rare') {
    return `${baseSlug}-V1-Rare`;
  }

  return baseSlug;
}

function getCardmarketSinglesPath(card: RiftCodexCard) {
  const expansion = getCardmarketExpansionPath(card);

  if (!expansion) {
    return getCardmarketPath(card.name);
  }

  return `/en/Riftbound/Products/Singles/${expansion}/${getCardmarketProductSlug(card)}`;
}

export function mapRiftCodexCard(card: RiftCodexCard): RiftboundCard {
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
    cardmarketPath: getCardmarketSinglesPath(card),
    rarity: card.classification?.rarity ?? undefined,
    alternateArt: card.metadata?.alternate_art,
    overnumbered: card.metadata?.overnumbered,
    signature: card.metadata?.signature,
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
  return (data.items ?? []).map(mapRiftCodexCard);
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

export async function findRiftCodexCardFromScan(input: CardScanInput) {
  const targetSetCode = input.setCode?.trim().toUpperCase();
  const targetNumber = input.number ? normalizeCollectorNumber(input.number) : '';
  const targetName = input.name ? normalizeText(input.name) : '';

  if (!targetSetCode && !targetNumber && !targetName) {
    return undefined;
  }

  const maxPages = targetSetCode ? 8 : 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const pageCards = await fetchRiftCodexPage(page, 50, targetSetCode);

    if (pageCards.length === 0) {
      return undefined;
    }

    const exactCollectorMatch = pageCards.find((card) => {
      const setMatches = targetSetCode ? getSetCode(card) === targetSetCode : true;
      const numberMatches = targetNumber
        ? normalizeCollectorNumber(getPrintedNumber(card)) === targetNumber
        : true;

      return setMatches && numberMatches;
    });

    if (exactCollectorMatch && (targetSetCode || targetNumber)) {
      return mapRiftCodexCard(exactCollectorMatch);
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
      return mapRiftCodexCard(nameMatch);
    }
  }

  return undefined;
}
