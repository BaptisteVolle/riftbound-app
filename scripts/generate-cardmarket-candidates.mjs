import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RIFTCODEX_CARDS_URL = 'https://api.riftcodex.com/cards';
const CARDMARKET_BASE_PATH = '/en/Riftbound/Products/Singles';
const OUTPUT_PATH = path.join(
  process.cwd(),
  'src',
  'features',
  'cardmarket',
  'cardmarket-candidates.data.ts',
);

const SET_SLUGS = {
  JDG: 'Origins-Promos',
  OGN: 'Origins',
  OGNX: 'Origins-Promos',
  OGS: 'Proving-Grounds',
  OPP: 'Origins-Promos',
  PR: 'Project-K-Promos',
  SFD: 'Spiritforged',
  SFDX: 'Spiritforged-Promos',
  UNL: 'Unleashed',
};

function getSetCode(card) {
  return (card.set?.set_id ?? card.set?.id ?? '').toUpperCase();
}

function getPrintedNumber(card) {
  const [, printedNumber] = card.riftbound_id?.match(/^[a-z]+-([^-]+)/i) ?? [];

  if (printedNumber) {
    return printedNumber.toUpperCase();
  }

  return String(card.collector_number ?? '').padStart(3, '0');
}

function stringLiteral(value) {
  return JSON.stringify(value ?? '');
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeNumber(value) {
  return String(value ?? '').trim().toUpperCase();
}

function stripGeneratedNameSuffixes(name) {
  return String(name ?? '')
    .replace(/\s+Alternate Art$/i, '')
    .replace(/\s+Overnumbered$/i, '')
    .replace(/\s+Signature$/i, '')
    .trim();
}

function slugifyCardmarketName(name) {
  return stripGeneratedNameSuffixes(name)
    .replace(/Kai'?Sa/gi, 'KaiSa')
    .replace(/Kha'?Zix/gi, 'KhaZix')
    .replace(/LeBlanc/gi, 'LeBlanc')
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getGeneratedCardmarketPath(card, allCards) {
  const specialPath = getGeneratedSpecialPath(card);

  if (specialPath) {
    return specialPath;
  }

  const setCode = getSetCode(card);
  const setSlug = SET_SLUGS[setCode];

  if (!setSlug) {
    return '';
  }

  const name = card.metadata?.clean_name ?? card.name;
  const suffix = getGeneratedVariantSuffix(card, allCards);
  return `${CARDMARKET_BASE_PATH}/${setSlug}/${slugifyCardmarketName(name)}${suffix}`;
}

function getGeneratedSpecialPath(card) {
  const setCode = getSetCode(card);
  const name = card.metadata?.clean_name ?? card.name;

  if (setCode === 'JDG' && normalizeText(name) === 'heimerdinger inventor') {
    return `${CARDMARKET_BASE_PATH}/Origins-Promos/Heimerdinger-Inventor-V2-Rare`;
  }

  return '';
}

function isUnleashedAlternateArt(card) {
  return getSetCode(card) === 'UNL' && Boolean(card.metadata?.alternate_art);
}

function getVariantGroupKey(card) {
  const name = stripGeneratedNameSuffixes(card.metadata?.clean_name ?? card.name);
  return `${getSetCode(card)}:${normalizeText(name)}`;
}

function hasVariantGroup(card, allCards) {
  const groupKey = getVariantGroupKey(card);
  return allCards.filter((candidate) => getVariantGroupKey(candidate) === groupKey).length > 1;
}

function getGeneratedVariantSuffix(card, allCards) {
  const rarity = card.classification?.rarity ?? '';

  if (card.metadata?.signature) {
    return getSetCode(card) === 'SFD' ? '-V2-Signed-Showcase' : '-V3-Overnumbered';
  }

  if (card.metadata?.overnumbered) {
    return '-V2-Overnumbered';
  }

  if (card.metadata?.alternate_art) {
    if (isUnleashedAlternateArt(card)) {
      return '-V2-Showcase';
    }

    return '-V2-Overnumbered';
  }

  if (hasVariantGroup(card, allCards)) {
    return `-V1-${slugifyCardmarketName(rarity)}`;
  }

  return '';
}

function getNotes(card) {
  const notes = [
    card.metadata?.alternate_art ? 'alternate_art' : '',
    card.metadata?.overnumbered ? 'overnumbered' : '',
    card.metadata?.signature ? 'signature' : '',
  ].filter(Boolean);

  return notes.join(', ');
}

async function fetchPage(page) {
  const params = new URLSearchParams({
    limit: '100',
    page: String(page),
  });
  const response = await fetch(`${RIFTCODEX_CARDS_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`RiftCodex page ${page} failed with ${response.status}`);
  }

  const data = await response.json();
  return data.items ?? [];
}

async function fetchAllCards() {
  const cards = [];

  for (let page = 1; page <= 100; page += 1) {
    const items = await fetchPage(page);

    if (items.length === 0) {
      break;
    }

    cards.push(...items);
  }

  return cards;
}

function toCandidate(card, allCards) {
  return {
    riftboundId: card.riftbound_id ?? card.id,
    setCode: getSetCode(card),
    number: getPrintedNumber(card),
    name: card.metadata?.clean_name ?? card.name,
    color: card.classification?.domain?.[0] ?? '',
    type: card.classification?.type ?? 'Card',
    rarity: card.classification?.rarity ?? '',
    imageUrl: card.media?.image_url ?? '',
    cardmarketPath: getGeneratedCardmarketPath(card, allCards),
    notes: getNotes(card),
  };
}

function renderCandidates(candidates) {
  const rows = candidates
    .map((candidate) => {
      const notesLine = candidate.notes ? `\n    notes: ${stringLiteral(candidate.notes)},` : '';

      return `  {
    riftboundId: ${stringLiteral(candidate.riftboundId)},
    setCode: ${stringLiteral(candidate.setCode)},
    number: ${stringLiteral(candidate.number)},
    name: ${stringLiteral(candidate.name)},
    color: ${stringLiteral(candidate.color)},
    type: ${stringLiteral(candidate.type)},
    rarity: ${stringLiteral(candidate.rarity)},
    imageUrl: ${stringLiteral(candidate.imageUrl)},
    cardmarketPath: ${stringLiteral(candidate.cardmarketPath)},${notesLine}
  },`;
    })
    .join('\n');

  return `import { CardmarketProductMapping } from './cardmarket.types';

// Generated by scripts/generate-cardmarket-candidates.mjs.
// Generated from RiftCodex metadata.
export const cardmarketCandidates: CardmarketProductMapping[] = [
${rows}
];
`;
}

const allCards = await fetchAllCards();
const candidates = allCards
  .map((card) => toCandidate(card, allCards))
  .sort((a, b) => {
    return (
      a.setCode.localeCompare(b.setCode) ||
      a.name.localeCompare(b.name) ||
      a.number.localeCompare(b.number)
    );
  });

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, renderCandidates(candidates));

console.log(`Fetched ${allCards.length} RiftCodex cards.`);
console.log(`Wrote ${candidates.length} Cardmarket products to ${OUTPUT_PATH}.`);
