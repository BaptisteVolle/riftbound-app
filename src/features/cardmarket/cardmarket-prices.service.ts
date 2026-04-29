import { Directory, File, Paths } from 'expo-file-system';

import { RiftboundCard } from '../cards/cards.types';
import { normalizeCollectorNumber } from '../riftcodex/riftcodex.service';
import {
  cardmarketProducts,
  findCardmarketOverride,
} from './cardmarket.service';
import {
  CardmarketOverride,
  CardmarketPriceGuide,
  CardmarketPriceGuideItem,
  CardmarketPriceSummary,
  CardmarketProductCatalog,
  CardmarketProductCatalogItem,
} from './cardmarket.types';

const CARDMARKET_PRODUCT_LIST_URL =
  'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_22.json';
const CARDMARKET_PRICE_GUIDE_URL =
  'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json';
export const CARDMARKET_PRICE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CARDMARKET_PRICE_FORCE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

const CACHE_DIRECTORY = new Directory(Paths.document, 'riftbound-app');
const PRODUCT_LIST_FILE = new File(CACHE_DIRECTORY, 'cardmarket-products-singles-22.json');
const PRICE_GUIDE_FILE = new File(CACHE_DIRECTORY, 'cardmarket-price-guide-22.json');
const PRICE_META_FILE = new File(CACHE_DIRECTORY, 'cardmarket-price-cache-meta.json');

const EXPANSION_IDS_BY_SLUG: Record<string, number> = {
  Origins: 6286,
  'Proving-Grounds': 6289,
  'Origins-Promos': 6322,
  Spiritforged: 6399,
  'Spiritforged-Promos': 6480,
  'Project-K-Promos': 6483,
  Unleashed: 6491,
};

type PriceCacheMeta = {
  updatedAt: string;
  forcedAt?: string;
};

export type CardmarketPriceCacheStatus = {
  hasCache: boolean;
  isFresh: boolean;
  updatedAt?: string;
  ageMs?: number;
  nextAutoRefreshAt?: string;
  canForceRefresh: boolean;
  forceRefreshAvailableInMs: number;
};

type LoadedPriceData = {
  catalog: CardmarketProductCatalog;
  priceGuide: CardmarketPriceGuide;
  priceGuideByProductId: Map<number, CardmarketPriceGuideItem>;
  productIdByCardKey: Map<string, number>;
};

let loadedPriceData: LoadedPriceData | undefined;

function ensureCacheDirectory() {
  CACHE_DIRECTORY.create({ intermediates: true, idempotent: true });
}

async function readJsonFile<T>(file: File) {
  if (!file.exists) {
    return undefined;
  }

  const text = await file.text();

  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function writeJsonFile(file: File, value: unknown) {
  ensureCacheDirectory();

  if (!file.exists) {
    file.create({ intermediates: true });
  }

  file.write(JSON.stringify(value, null, 2));
}

function normalizeText(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+\((alternate art|overnumbered|signature|metal)\)$/i, '')
    .replace(/\s+(alternate art|overnumbered|signature|metal)$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getCardKey(card: Pick<CardmarketOverride, 'setCode' | 'number' | 'name'>) {
  return [
    card.setCode.toUpperCase(),
    normalizeCollectorNumber(card.number),
    normalizeText(card.name),
  ].join(':');
}

function getExpansionIdFromPath(pathOrUrl: string) {
  const [, expansionSlug] =
    pathOrUrl.match(/\/Riftbound\/Products\/Singles\/([^/?#]+)\//) ?? [];

  if (!expansionSlug) {
    return undefined;
  }

  return EXPANSION_IDS_BY_SLUG[expansionSlug];
}

function getProductGroupKey(product: CardmarketProductCatalogItem) {
  return `${product.idExpansion}:${normalizeText(product.name)}`;
}

function getLocalGroupKey(product: CardmarketOverride) {
  const expansionId = getExpansionIdFromPath(product.cardmarketPath);

  if (!expansionId) {
    return undefined;
  }

  return `${expansionId}:${normalizeText(product.name)}`;
}

function getVariantSortValue(product: CardmarketOverride) {
  const normalizedNumber = normalizeCollectorNumber(product.number);
  const [, numberPart = '0', suffix = ''] =
    normalizedNumber.match(/^(\d+)([A-Z*]*)$/) ?? [];
  const suffixOrder =
    suffix === ''
      ? 0
      : suffix === 'A'
        ? 1
        : suffix === 'B'
          ? 2
          : suffix === '*'
            ? 4
            : 3;
  const notes = product.notes ?? '';
  const noteOrder = notes.includes('signature')
    ? 4
    : notes.includes('overnumbered')
      ? 3
      : notes.includes('alternate_art')
        ? 2
        : 0;

  return Number(numberPart) * 10 + Math.max(suffixOrder, noteOrder);
}

function buildProductIdByCardKey(catalog: CardmarketProductCatalog) {
  const catalogGroups = new Map<string, CardmarketProductCatalogItem[]>();

  catalog.products.forEach((product) => {
    const groupKey = getProductGroupKey(product);
    const group = catalogGroups.get(groupKey) ?? [];
    group.push(product);
    catalogGroups.set(groupKey, group);
  });

  const localGroups = new Map<string, CardmarketOverride[]>();

  cardmarketProducts.forEach((product) => {
    if (!product.cardmarketPath.trim()) {
      return;
    }

    const groupKey = getLocalGroupKey(product);

    if (!groupKey) {
      return;
    }

    const group = localGroups.get(groupKey) ?? [];
    const localKey = getCardKey(product);

    if (!group.some((candidate) => getCardKey(candidate) === localKey)) {
      group.push(product);
    }

    localGroups.set(groupKey, group);
  });

  const productIdByCardKey = new Map<string, number>();

  localGroups.forEach((localProducts, groupKey) => {
    const catalogProducts = catalogGroups.get(groupKey);

    if (!catalogProducts?.length) {
      return;
    }

    const sortedCatalogProducts = [...catalogProducts].sort((a, b) => {
      return a.dateAdded.localeCompare(b.dateAdded) || a.idProduct - b.idProduct;
    });
    const sortedLocalProducts = [...localProducts].sort((a, b) => {
      return (
        getVariantSortValue(a) - getVariantSortValue(b) ||
        normalizeCollectorNumber(a.number).localeCompare(normalizeCollectorNumber(b.number))
      );
    });

    sortedLocalProducts.forEach((product, index) => {
      const catalogProduct =
        sortedCatalogProducts[index] ??
        (sortedCatalogProducts.length === 1 ? sortedCatalogProducts[0] : undefined);

      if (catalogProduct) {
        productIdByCardKey.set(getCardKey(product), catalogProduct.idProduct);
      }
    });
  });

  return productIdByCardKey;
}

async function downloadJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function hasFreshCache() {
  return (await getCardmarketPriceCacheStatus()).isFresh;
}

function getTimestamp(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export async function getCardmarketPriceCacheStatus(): Promise<CardmarketPriceCacheStatus> {
  const meta = await readJsonFile<PriceCacheMeta>(PRICE_META_FILE);
  const updatedAtTimestamp = getTimestamp(meta?.updatedAt);
  const cooldownTimestamp = getTimestamp(meta?.forcedAt ?? meta?.updatedAt);
  const hasCache = Boolean(
    updatedAtTimestamp &&
      PRODUCT_LIST_FILE.exists &&
      PRICE_GUIDE_FILE.exists,
  );
  const ageMs = updatedAtTimestamp ? Date.now() - updatedAtTimestamp : undefined;
  const forceRefreshAvailableInMs = cooldownTimestamp
    ? Math.max(
        0,
        CARDMARKET_PRICE_FORCE_REFRESH_COOLDOWN_MS - (Date.now() - cooldownTimestamp),
      )
    : 0;

  return {
    hasCache,
    isFresh:
      hasCache &&
      ageMs !== undefined &&
      ageMs >= 0 &&
      ageMs < CARDMARKET_PRICE_CACHE_MAX_AGE_MS,
    updatedAt: meta?.updatedAt,
    ageMs,
    nextAutoRefreshAt: updatedAtTimestamp
      ? new Date(updatedAtTimestamp + CARDMARKET_PRICE_CACHE_MAX_AGE_MS).toISOString()
      : undefined,
    canForceRefresh: forceRefreshAvailableInMs === 0,
    forceRefreshAvailableInMs,
  };
}

async function loadPriceDataFromDisk() {
  const catalog = await readJsonFile<CardmarketProductCatalog>(PRODUCT_LIST_FILE);
  const priceGuide = await readJsonFile<CardmarketPriceGuide>(PRICE_GUIDE_FILE);

  if (!catalog?.products || !priceGuide?.priceGuides) {
    return undefined;
  }

  return buildLoadedPriceData(catalog, priceGuide);
}

function buildLoadedPriceData(
  catalog: CardmarketProductCatalog,
  priceGuide: CardmarketPriceGuide,
): LoadedPriceData {
  return {
    catalog,
    priceGuide,
    priceGuideByProductId: new Map(
      priceGuide.priceGuides.map((priceGuideItem) => [
        priceGuideItem.idProduct,
        priceGuideItem,
      ]),
    ),
    productIdByCardKey: buildProductIdByCardKey(catalog),
  };
}

export async function refreshCardmarketPriceData(force = false) {
  if (loadedPriceData && !force && (await hasFreshCache())) {
    return loadedPriceData;
  }

  ensureCacheDirectory();

  if (!force && (await hasFreshCache())) {
    const diskData = await loadPriceDataFromDisk();

    if (diskData) {
      loadedPriceData = diskData;
      return loadedPriceData;
    }
  }

  try {
    const [catalog, priceGuide] = await Promise.all([
      downloadJson<CardmarketProductCatalog>(CARDMARKET_PRODUCT_LIST_URL),
      downloadJson<CardmarketPriceGuide>(CARDMARKET_PRICE_GUIDE_URL),
    ]);

    const now = new Date().toISOString();
    writeJsonFile(PRODUCT_LIST_FILE, catalog);
    writeJsonFile(PRICE_GUIDE_FILE, priceGuide);
    writeJsonFile(PRICE_META_FILE, {
      updatedAt: now,
      forcedAt: force ? now : undefined,
    });

    loadedPriceData = buildLoadedPriceData(catalog, priceGuide);
    return loadedPriceData;
  } catch (error) {
    const diskData = await loadPriceDataFromDisk();

    if (diskData) {
      loadedPriceData = diskData;
      return loadedPriceData;
    }

    throw error;
  }
}

export async function forceRefreshCardmarketPriceData() {
  const status = await getCardmarketPriceCacheStatus();

  if (!status.canForceRefresh) {
    return {
      data: await refreshCardmarketPriceData(),
      status,
      didRefresh: false,
    };
  }

  return {
    data: await refreshCardmarketPriceData(true),
    status: await getCardmarketPriceCacheStatus(),
    didRefresh: true,
  };
}

export function formatPriceCacheAge(ageMs?: number) {
  if (ageMs === undefined) {
    return 'never';
  }

  const minutes = Math.floor(ageMs / 60000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 48) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

export function formatRefreshWaitTime(ms: number) {
  const seconds = Math.ceil(ms / 1000);

  if (seconds <= 0) {
    return 'now';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.ceil(seconds / 60)}m`;
}

export async function getCardmarketPriceForCard(card: RiftboundCard) {
  const data = await refreshCardmarketPriceData();
  const override = findCardmarketOverride(card);

  if (!override) {
    return undefined;
  }

  const idProduct = data.productIdByCardKey.get(getCardKey(override));

  if (!idProduct) {
    return undefined;
  }

  const priceGuideItem = data.priceGuideByProductId.get(idProduct);

  if (!priceGuideItem) {
    return undefined;
  }

  return {
    idProduct,
    updatedAt: data.priceGuide.createdAt,
    low: priceGuideItem.low,
    trend: priceGuideItem.trend,
    avg: priceGuideItem.avg,
    lowFoil: priceGuideItem['low-foil'],
    trendFoil: priceGuideItem['trend-foil'],
    avgFoil: priceGuideItem['avg-foil'],
  } satisfies CardmarketPriceSummary;
}

export function getDisplayPrice(
  price: CardmarketPriceSummary | undefined,
  key: 'low' | 'trend' | 'avg',
  printing: 'normal' | 'foil',
) {
  if (!price) {
    return undefined;
  }

  if (printing === 'foil') {
    if (key === 'low') {
      return price.lowFoil ?? price.low;
    }

    if (key === 'trend') {
      return price.trendFoil ?? price.trend;
    }

    return price.avgFoil ?? price.avg;
  }

  return price[key];
}

export function formatCardmarketPrice(value?: number | null) {
  if (value === undefined || value === null) {
    return 'N/A';
  }

  return `${value.toFixed(2).replace('.', ',')} €`;
}
