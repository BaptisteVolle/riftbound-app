import { RiftboundCard } from '../cards/cards.types';
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

function getCardmarketPath(name: string) {
  const slug = name
    .replace(/\s+\(Alternate Art\)$/i, '')
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `/en/Riftbound/Cards/${slug}`;
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
    cardmarketPath: getCardmarketPath(card.name),
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
