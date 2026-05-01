import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import {
  CardmarketPriceCacheStatus,
  forceRefreshCardmarketPriceData,
  formatCardmarketPrice,
  formatPriceCacheAge,
  formatRefreshWaitTime,
  getCardmarketPriceCacheStatus,
  getCardmarketPriceForCard,
  getDisplayPrice,
} from '../src/features/cardmarket/cardmarket-prices.service';
import { CardmarketPriceSummary } from '../src/features/cardmarket/cardmarket.types';
import {
  buildCardmarketSearchUrl,
  CardexVariantFilter,
  REAL_CARDEX_SET_CODES,
  getCardexCards,
  getOpenableCardmarketUrlForCard,
  matchesCardexFilters,
} from '../src/features/cards/cards.service';
import { RiftboundCard } from '../src/features/cards/cards.types';
import {
  addCardToCollection,
  getCollection,
  getCollectionCardKey,
  getCollectionTotals,
  removeCardFromCollection,
} from '../src/features/collection/collection.service';
import { CollectionEntry, CollectionPrinting } from '../src/features/collection/collection.types';
import { normalizeCollectorNumber } from '../src/features/riftcodex/riftcodex.service';
import { formatCardMeta } from '../src/lib/utils';

type PrintingFilter = 'all' | 'normal' | 'foil';
type CollectionMode = 'inventory' | 'bulk';
type SortKey =
  | 'set'
  | 'name'
  | 'color'
  | 'normal'
  | 'foil'
  | 'total'
  | 'low'
  | 'avg'
  | 'trend'
  | 'value';
type SortDirection = 'asc' | 'desc';

type CollectionRow = {
  entry: CollectionEntry;
  price?: CardmarketPriceSummary;
  low?: number | null;
  avg?: number | null;
  trend?: number | null;
  estimatedValue: number;
  totalQuantity: number;
};

const SORT_OPTIONS: SortKey[] = ['set', 'name', 'color', 'normal', 'foil', 'total', 'low', 'avg', 'trend', 'value'];
const BULK_PAGE_SIZE = 60;
const VARIANT_FILTER_OPTIONS: CardexVariantFilter[] = ['ALL', 'BASE', 'ALTERNATE', 'OVERNUMBERED', 'SIGNATURE'];

function getOptionValues(values: string[]) {
  return ['ALL', ...new Set(values.filter(Boolean).sort((a, b) => a.localeCompare(b)))];
}

function getNextOption(options: string[], current: string) {
  const currentIndex = options.indexOf(current);
  return options[(currentIndex + 1) % options.length] ?? options[0];
}

function getNextSortKey(current: SortKey) {
  return SORT_OPTIONS[(SORT_OPTIONS.indexOf(current) + 1) % SORT_OPTIONS.length];
}

function getNormalValue(price?: CardmarketPriceSummary) {
  return price?.trend ?? price?.avg ?? price?.low ?? 0;
}

function getFoilValue(price?: CardmarketPriceSummary) {
  return price?.trendFoil ?? price?.avgFoil ?? price?.lowFoil ?? 0;
}

function buildRow(entry: CollectionEntry, price?: CardmarketPriceSummary): CollectionRow {
  const displayPrinting = entry.foilQuantity > 0 && entry.normalQuantity === 0 ? 'foil' : 'normal';

  return {
    entry,
    price,
    low: getDisplayPrice(price, 'low', displayPrinting),
    avg: getDisplayPrice(price, 'avg', displayPrinting),
    trend: getDisplayPrice(price, 'trend', displayPrinting),
    estimatedValue:
      entry.normalQuantity * getNormalValue(price) +
      entry.foilQuantity * getFoilValue(price),
    totalQuantity: entry.normalQuantity + entry.foilQuantity,
  };
}

function compareSetNumber(a: CollectionRow, b: CollectionRow) {
  return (
    a.entry.card.setCode.localeCompare(b.entry.card.setCode) ||
    normalizeCollectorNumber(a.entry.card.number).localeCompare(normalizeCollectorNumber(b.entry.card.number)) ||
    a.entry.card.name.localeCompare(b.entry.card.name)
  );
}

function getSortValue(row: CollectionRow, sortKey: SortKey) {
  switch (sortKey) {
    case 'name':
      return row.entry.card.name;
    case 'color':
      return row.entry.card.color;
    case 'normal':
      return row.entry.normalQuantity;
    case 'foil':
      return row.entry.foilQuantity;
    case 'total':
      return row.totalQuantity;
    case 'low':
      return row.low ?? -1;
    case 'avg':
      return row.avg ?? -1;
    case 'trend':
      return row.trend ?? -1;
    case 'value':
      return row.estimatedValue;
    case 'set':
    default:
      return '';
  }
}

function sortRows(rows: CollectionRow[], sortKey: SortKey, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortKey === 'set') {
      return compareSetNumber(a, b) * multiplier;
    }

    const left = getSortValue(a, sortKey);
    const right = getSortValue(b, sortKey);

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right || compareSetNumber(a, b)) * multiplier;
    }

    return (String(left).localeCompare(String(right)) || compareSetNumber(a, b)) * multiplier;
  });
}

function getOwnershipMap(collection: CollectionEntry[]) {
  return new Map(collection.map((entry) => [entry.cardKey, entry]));
}

export default function CollectionScreen() {
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [pricesByKey, setPricesByKey] = useState<Record<string, CardmarketPriceSummary | undefined>>({});
  const [mode, setMode] = useState<CollectionMode>('inventory');
  const [query, setQuery] = useState('');
  const [setFilter, setSetFilter] = useState('ALL');
  const [colorFilter, setColorFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [printingFilter, setPrintingFilter] = useState<PrintingFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('set');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [bulkQuery, setBulkQuery] = useState('');
  const [bulkSetFilter, setBulkSetFilter] = useState('ALL');
  const [bulkTypeFilter, setBulkTypeFilter] = useState('ALL');
  const [bulkVariantFilter, setBulkVariantFilter] = useState<CardexVariantFilter>('ALL');
  const [bulkOwnershipFilter, setBulkOwnershipFilter] = useState<'all' | 'missing' | 'owned'>('all');
  const [bulkVisibleCount, setBulkVisibleCount] = useState(BULK_PAGE_SIZE);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [priceCacheStatus, setPriceCacheStatus] =
    useState<CardmarketPriceCacheStatus>();
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  const loadCollection = useCallback(async () => {
    setIsLoading(true);
    setCollection(await getCollection());
    setPriceCacheStatus(await getCardmarketPriceCacheStatus());
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      Promise.all([getCollection(), getCardmarketPriceCacheStatus()])
        .then(([entries, cacheStatus]) => {
          if (isActive) {
            setCollection(entries);
            setPriceCacheStatus(cacheStatus);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isActive) {
            setMessage('Collection could not be loaded.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  useEffect(() => {
    let isActive = true;

    Promise.all(
      collection.map(async (entry) => {
        const price = await getCardmarketPriceForCard(entry.card).catch(() => undefined);
        return [entry.cardKey, price] as const;
      }),
    ).then((entries) => {
      if (isActive) {
        setPricesByKey(Object.fromEntries(entries));
      }
    });

    return () => {
      isActive = false;
    };
  }, [collection]);

  const totals = useMemo(() => getCollectionTotals(collection), [collection]);
  const ownershipByKey = useMemo(() => getOwnershipMap(collection), [collection]);
  const setOptions = useMemo(() => getOptionValues(collection.map((entry) => entry.card.setCode)), [collection]);
  const colorOptions = useMemo(() => getOptionValues(collection.map((entry) => entry.card.color)), [collection]);
  const rarityOptions = useMemo(
    () => getOptionValues(collection.map((entry) => entry.card.rarity ?? entry.card.type)),
    [collection],
  );
  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const builtRows = collection.map((entry) => buildRow(entry, pricesByKey[entry.cardKey]));

    const filteredRows = builtRows.filter((row) => {
      const { entry } = row;
      const rarity = entry.card.rarity ?? entry.card.type;
      const haystack = `${entry.card.name} ${entry.card.set} ${entry.card.setCode} ${entry.card.number} ${entry.card.color} ${rarity}`
        .toLowerCase();

      if (normalizedQuery && !haystack.includes(normalizedQuery)) {
        return false;
      }

      if (setFilter !== 'ALL' && entry.card.setCode !== setFilter) {
        return false;
      }

      if (colorFilter !== 'ALL' && entry.card.color !== colorFilter) {
        return false;
      }

      if (rarityFilter !== 'ALL' && rarity !== rarityFilter) {
        return false;
      }

      if (printingFilter === 'normal' && entry.normalQuantity <= 0) {
        return false;
      }

      if (printingFilter === 'foil' && entry.foilQuantity <= 0) {
        return false;
      }

      return row.totalQuantity > 0;
    });

    return sortRows(filteredRows, sortKey, sortDirection);
  }, [collection, colorFilter, pricesByKey, printingFilter, query, rarityFilter, setFilter, sortDirection, sortKey]);
  const filteredCardIds = useMemo(
    () => rows.map((row) => row.entry.card.id),
    [rows],
  );
  const estimatedTotal = useMemo(() => {
    return rows.reduce((total, row) => total + row.estimatedValue, 0);
  }, [rows]);
  const bulkCards = getCardexCards();
  const bulkSetOptions = useMemo(() => ['ALL', ...REAL_CARDEX_SET_CODES], []);
  const bulkTypeOptions = useMemo(
    () => ['ALL', ...new Set(bulkCards.map((card) => card.type).sort((a, b) => a.localeCompare(b)))],
    [bulkCards],
  );
  const filteredBulkCards = useMemo(() => {
    return bulkCards.filter((card) => {
      const entry = ownershipByKey.get(getCollectionCardKey(card));
      const totalOwned = (entry?.normalQuantity ?? 0) + (entry?.foilQuantity ?? 0);

      if (bulkOwnershipFilter === 'missing' && totalOwned > 0) {
        return false;
      }

      if (bulkOwnershipFilter === 'owned' && totalOwned === 0) {
        return false;
      }

      return matchesCardexFilters(card, {
        query: bulkQuery,
        setFilter: bulkSetFilter,
        typeFilter: bulkTypeFilter,
        variantFilter: bulkVariantFilter,
      });
    });
  }, [bulkCards, bulkOwnershipFilter, bulkQuery, bulkSetFilter, bulkTypeFilter, bulkVariantFilter, ownershipByKey]);
  const visibleBulkCards = useMemo(() => {
    return filteredBulkCards.slice(0, bulkVisibleCount);
  }, [bulkVisibleCount, filteredBulkCards]);

  useEffect(() => {
    setBulkVisibleCount(BULK_PAGE_SIZE);
  }, [bulkOwnershipFilter, bulkQuery, bulkSetFilter, bulkTypeFilter, bulkVariantFilter]);

  async function changeCardQuantity(
    card: RiftboundCard,
    printing: CollectionPrinting,
    delta: number,
  ) {
    setMessage('');

    if (delta > 0) {
      await addCardToCollection(card, printing);
    } else {
      await removeCardFromCollection(getCollectionCardKey(card), printing);
    }

    await loadCollection();
  }

  async function changeQuantity(
    entry: CollectionEntry,
    printing: CollectionPrinting,
    delta: number,
  ) {
    await changeCardQuantity(entry.card as RiftboundCard, printing, delta);
  }

  async function openPrice(entry: CollectionEntry) {
    setMessage('Checking Cardmarket page...');

    const resolvedUrl = await getOpenableCardmarketUrlForCard(entry.card, {
      printing:
        entry.foilQuantity > 0 && entry.normalQuantity === 0 ? 'foil' : 'normal',
    });
    const url = resolvedUrl.url ?? buildCardmarketSearchUrl({
      name: entry.card.name,
    });

    if (!url) {
      setMessage('No Cardmarket URL found for this card.');
      return;
    }

    setMessage(
      resolvedUrl.mode === 'search'
        ? 'Exact page returned 404. Opening name search.'
        : '',
    );
    Linking.openURL(url);
  }

  function openCard(entry: CollectionEntry) {
    router.push({
      pathname: '/card/[id]',
      params: {
        id: entry.card.id,
        ids: filteredCardIds.join(','),
      },
    });
  }

  async function refreshPrices() {
    setMessage('');
    setIsRefreshingPrices(true);

    try {
      const result = await forceRefreshCardmarketPriceData();
      const nextStatus = await getCardmarketPriceCacheStatus();
      setPriceCacheStatus(nextStatus);

      if (result.didRefresh) {
        setMessage('Cardmarket prices refreshed.');
      } else {
        setMessage(
          `Prices were refreshed recently. Try again in ${formatRefreshWaitTime(
            result.status.forceRefreshAvailableInMs,
          )}.`,
        );
      }
    } catch {
      setMessage('Could not refresh prices. Using the last cached file if available.');
      setPriceCacheStatus(await getCardmarketPriceCacheStatus());
    } finally {
      setIsRefreshingPrices(false);
    }
  }

  const priceRefreshDisabled =
    isRefreshingPrices ||
    Boolean(
      priceCacheStatus &&
        !priceCacheStatus.canForceRefresh &&
        priceCacheStatus.forceRefreshAvailableInMs > 0,
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>COLLECTION</Text>
      <View style={styles.summary}>
        <SummaryItem label="UNIQUE" value={String(totals.uniqueCards)} />
        <SummaryItem label="TOTAL" value={String(totals.totalCards)} />
        <SummaryItem label="FOIL" value={String(totals.foilCards)} />
        <SummaryItem label="VALUE" value={formatCardmarketPrice(estimatedTotal)} />
      </View>

      <View style={styles.topActions}>
        <Button label="SCAN" tone="orange" style={styles.topButton} onPress={() => router.push('/scan')} />
        <Button label="CARDEX" tone="gold" style={styles.topButton} onPress={() => router.push('/cardex')} />
      </View>

      <View style={styles.modeSwitch}>
        <Pressable
          onPress={() => setMode('inventory')}
          style={[styles.modeButton, mode === 'inventory' && styles.modeButtonActive]}
        >
          <Text style={[styles.modeButtonText, mode === 'inventory' && styles.modeButtonTextActive]}>Inventory</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('bulk')}
          style={[styles.modeButton, mode === 'bulk' && styles.modeButtonActive]}
        >
          <Text style={[styles.modeButtonText, mode === 'bulk' && styles.modeButtonTextActive]}>Bulk Add</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {mode === 'inventory' ? (
        <>
          <View style={styles.priceSyncPanel}>
            <View style={styles.priceSyncCopy}>
              <Text style={styles.priceSyncTitle}>CARDMARKET PRICES</Text>
              <Text style={styles.priceSyncText}>
                Updated {formatPriceCacheAge(priceCacheStatus?.ageMs)}
              </Text>
            </View>
            <Button
              disabled={priceRefreshDisabled}
              label={
                isRefreshingPrices
                  ? 'UPDATING...'
                  : priceCacheStatus?.canForceRefresh === false
                    ? `WAIT ${formatRefreshWaitTime(priceCacheStatus.forceRefreshAvailableInMs)}`
                    : 'REFRESH'
              }
              tone="blue"
              style={styles.priceSyncButton}
              onPress={refreshPrices}
            />
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Filter owned cards..."
            placeholderTextColor="#555"
            style={styles.input}
            value={query}
          />

          <View style={styles.filterGrid}>
            <FilterButton label={`SET ${setFilter}`} onPress={() => setSetFilter(getNextOption(setOptions, setFilter))} />
            <FilterButton label={`COLOR ${colorFilter}`} onPress={() => setColorFilter(getNextOption(colorOptions, colorFilter))} />
            <FilterButton label={`RARITY ${rarityFilter}`} onPress={() => setRarityFilter(getNextOption(rarityOptions, rarityFilter))} />
            <FilterButton
              label={`PRINT ${printingFilter.toUpperCase()}`}
              onPress={() =>
                setPrintingFilter((current) =>
                  current === 'all' ? 'normal' : current === 'normal' ? 'foil' : 'all',
                )
              }
            />
            <FilterButton label={`SORT ${sortKey.toUpperCase()}`} onPress={() => setSortKey(getNextSortKey(sortKey))} />
            <FilterButton
              label={sortDirection === 'asc' ? 'ASC' : 'DESC'}
              onPress={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
            />
          </View>

          {isLoading ? <Text style={styles.empty}>Loading collection...</Text> : null}
          {!isLoading && collection.length === 0 ? (
            <Text style={styles.empty}>No cards yet. Use Bulk Add or Scan to start.</Text>
          ) : null}
          {!isLoading && collection.length > 0 && rows.length === 0 ? (
            <Text style={styles.empty}>No owned cards match these filters.</Text>
          ) : null}

          <View style={styles.results}>
            {rows.map((row) => (
              <InventoryRow
                key={row.entry.cardKey}
                row={row}
                onOpenCard={() => openCard(row.entry)}
                onOpenPrice={() => openPrice(row.entry)}
                onChangeQuantity={changeQuantity}
              />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.bulkHint}>
            Fast entry for piles: filter, then tap + or - for Normal and Foil.
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setBulkQuery}
            placeholder="Find a card to add..."
            placeholderTextColor="#555"
            style={styles.input}
            value={bulkQuery}
          />
          <View style={styles.filterGrid}>
            <FilterButton label={`SET ${bulkSetFilter}`} onPress={() => setBulkSetFilter(getNextOption(bulkSetOptions, bulkSetFilter))} />
            <FilterButton label={`TYPE ${bulkTypeFilter}`} onPress={() => setBulkTypeFilter(getNextOption(bulkTypeOptions, bulkTypeFilter))} />
            <FilterButton
              label={`VAR ${bulkVariantFilter}`}
              onPress={() => setBulkVariantFilter(getNextOption(VARIANT_FILTER_OPTIONS, bulkVariantFilter) as CardexVariantFilter)}
            />
            <FilterButton
              label={bulkOwnershipFilter.toUpperCase()}
              onPress={() =>
                setBulkOwnershipFilter((current) =>
                  current === 'all' ? 'missing' : current === 'missing' ? 'owned' : 'all',
                )
              }
            />
          </View>

          <Text style={styles.bulkCount}>
            {visibleBulkCards.length} / {filteredBulkCards.length} cards
          </Text>

          <View style={styles.results}>
            {visibleBulkCards.map((card) => {
              const entry = ownershipByKey.get(getCollectionCardKey(card));

              return (
                <BulkAddRow
                  card={card}
                  key={card.id}
                  normalQuantity={entry?.normalQuantity ?? 0}
                  foilQuantity={entry?.foilQuantity ?? 0}
                  onChangeQuantity={changeCardQuantity}
                />
              );
            })}
          </View>
          {bulkVisibleCount < filteredBulkCards.length ? (
            <Button
              label="LOAD MORE"
              tone="blue"
              style={styles.loadMoreButton}
              onPress={() => {
                setBulkVisibleCount((current) => {
                  return Math.min(filteredBulkCards.length, current + BULK_PAGE_SIZE);
                });
              }}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function FilterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button label={label} tone="blue" style={styles.filterButton} labelStyle={styles.filterButtonLabel} onPress={onPress} />;
}

function InventoryRow({
  row,
  onOpenCard,
  onOpenPrice,
  onChangeQuantity,
}: {
  row: CollectionRow;
  onOpenCard: () => void;
  onOpenPrice: () => void;
  onChangeQuantity: (
    entry: CollectionEntry,
    printing: CollectionPrinting,
    delta: number,
  ) => void;
}) {
  const { entry } = row;
  const rarityTone = getRarityTone(entry.card.rarity);
  const colorTone = getColorTone(entry.card.color);

  return (
    <View style={styles.inventoryRow}>
      <Pressable onPress={onOpenCard} style={styles.inventoryMain}>
        {entry.card.imageUrl ? (
          <Image source={{ uri: entry.card.imageUrl }} style={styles.inventoryThumbnail} />
        ) : (
          <View style={styles.inventoryThumbnail} />
        )}

        <View style={styles.inventoryInfo}>
          <View style={styles.inventoryTopLine}>
            <View style={[styles.typeBadge, getTypeTone(entry.card.type)]}>
              <Text style={styles.typeBadgeText}>{getTypeLabel(entry.card.type)}</Text>
            </View>
            <Text numberOfLines={1} style={styles.inventoryType}>
              {entry.card.type}
            </Text>
            <Text style={styles.inventoryMeta}>{formatCardMeta(entry.card.setCode, entry.card.number)}</Text>
          </View>

          <View style={styles.inventoryNameLine}>
            <View style={[styles.rarityIcon, rarityTone]}>
              <Text style={styles.rarityIconText}>{getRarityIcon(entry.card.rarity)}</Text>
            </View>
            <Text style={styles.totalQuantity}>{entry.normalQuantity + entry.foilQuantity}</Text>
            <Text numberOfLines={1} style={styles.inventoryName}>{entry.card.name}</Text>
          </View>
        </View>

        <View style={styles.inventoryPriceBlock}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.trendPrice}>
            {formatCardmarketPrice(row.trend)}
          </Text>
          <View style={[styles.colorIcon, colorTone]}>
            <Text style={styles.colorIconText}>{getColorIcon(entry.card.color)}</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.inventoryActions}>
        <MiniQuantityControl
          label="N"
          value={entry.normalQuantity}
          onIncrement={() => onChangeQuantity(entry, 'normal', 1)}
          onDecrement={() => onChangeQuantity(entry, 'normal', -1)}
        />
        <MiniQuantityControl
          label="F"
          value={entry.foilQuantity}
          onIncrement={() => onChangeQuantity(entry, 'foil', 1)}
          onDecrement={() => onChangeQuantity(entry, 'foil', -1)}
        />
        <Button label="CM" tone="dark" style={styles.compactCardmarketButton} labelStyle={styles.compactCardmarketButtonLabel} onPress={onOpenPrice} />
      </View>
    </View>
  );
}

function BulkAddRow({
  card,
  foilQuantity,
  normalQuantity,
  onChangeQuantity,
}: {
  card: RiftboundCard;
  foilQuantity: number;
  normalQuantity: number;
  onChangeQuantity: (
    card: RiftboundCard,
    printing: CollectionPrinting,
    delta: number,
  ) => void;
}) {
  return (
    <View style={styles.bulkRow}>
      <View style={styles.bulkCardInfo}>
        <Text numberOfLines={1} style={styles.cardName}>{card.name}</Text>
        <Text style={styles.meta}>{formatCardMeta(card.setCode, card.number)}</Text>
        <Text numberOfLines={1} style={styles.subMeta}>
          {card.type} - {card.rarity ?? card.color}
        </Text>
      </View>
      <View style={styles.bulkQuantityGrid}>
        <QuantityControl
          label="N"
          value={normalQuantity}
          onIncrement={() => onChangeQuantity(card, 'normal', 1)}
          onDecrement={() => onChangeQuantity(card, 'normal', -1)}
        />
        <QuantityControl
          label="F"
          value={foilQuantity}
          onIncrement={() => onChangeQuantity(card, 'foil', 1)}
          onDecrement={() => onChangeQuantity(card, 'foil', -1)}
        />
      </View>
    </View>
  );
}

function MiniQuantityControl({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View style={styles.miniQuantityBox}>
      <Text style={styles.miniQuantityLabel}>{label}</Text>
      <Button disabled={value === 0} label="-" tone="dark" style={styles.miniStepper} labelStyle={styles.miniStepperLabel} onPress={onDecrement} />
      <Text style={styles.miniQuantityValue}>{value}</Text>
      <Button label="+" tone="dark" style={styles.miniStepper} labelStyle={styles.miniStepperLabel} onPress={onIncrement} />
    </View>
  );
}

function getTypeLabel(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('battlefield')) {
    return 'BF';
  }

  return type.slice(0, 1).toUpperCase();
}

function getTypeTone(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('legend')) {
    return styles.typeLegend;
  }

  if (normalizedType.includes('champion')) {
    return styles.typeChampion;
  }

  if (normalizedType.includes('battlefield')) {
    return styles.typeBattlefield;
  }

  if (normalizedType.includes('spell')) {
    return styles.typeSpell;
  }

  if (normalizedType.includes('gear')) {
    return styles.typeGear;
  }

  return styles.typeUnit;
}

function getRarityIcon(rarity?: string) {
  const normalizedRarity = rarity?.toLowerCase() ?? '';

  if (normalizedRarity.includes('legendary')) {
    return 'L';
  }

  if (normalizedRarity.includes('epic')) {
    return 'E';
  }

  if (normalizedRarity.includes('rare')) {
    return 'R';
  }

  if (normalizedRarity.includes('uncommon')) {
    return 'U';
  }

  return 'C';
}

function getRarityTone(rarity?: string) {
  const normalizedRarity = rarity?.toLowerCase() ?? '';

  if (normalizedRarity.includes('legendary')) {
    return styles.rarityLegendary;
  }

  if (normalizedRarity.includes('epic')) {
    return styles.rarityEpic;
  }

  if (normalizedRarity.includes('rare')) {
    return styles.rarityRare;
  }

  if (normalizedRarity.includes('uncommon')) {
    return styles.rarityUncommon;
  }

  return styles.rarityCommon;
}

function getColorIcon(color: string) {
  const normalizedColor = color.toLowerCase();

  if (normalizedColor.includes('calm')) {
    return 'C';
  }

  if (normalizedColor.includes('fury')) {
    return 'F';
  }

  if (normalizedColor.includes('chaos')) {
    return 'X';
  }

  if (normalizedColor.includes('mind')) {
    return 'M';
  }

  if (normalizedColor.includes('body')) {
    return 'B';
  }

  if (normalizedColor.includes('order')) {
    return 'O';
  }

  return color.slice(0, 1).toUpperCase();
}

function getColorTone(color: string) {
  const normalizedColor = color.toLowerCase();

  if (normalizedColor.includes('calm')) {
    return styles.colorCalm;
  }

  if (normalizedColor.includes('fury')) {
    return styles.colorFury;
  }

  if (normalizedColor.includes('chaos')) {
    return styles.colorChaos;
  }

  if (normalizedColor.includes('mind')) {
    return styles.colorMind;
  }

  if (normalizedColor.includes('body')) {
    return styles.colorBody;
  }

  if (normalizedColor.includes('order')) {
    return styles.colorOrder;
  }

  return styles.colorNeutral;
}

function QuantityControl({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View style={styles.quantityBox}>
      <Text style={styles.quantityLabel}>{label}</Text>
      <Button disabled={value === 0} label="-" tone="dark" style={styles.stepper} labelStyle={styles.stepperLabel} onPress={onDecrement} />
      <Text style={styles.quantityValue}>{value}</Text>
      <Button label="+" tone="dark" style={styles.stepper} labelStyle={styles.stepperLabel} onPress={onIncrement} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 14,
    paddingBottom: 42,
    backgroundColor: '#081B2E',
  },
  title: {
    color: '#F7FBFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#FFD84D',
    shadowColor: '#111',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  summaryValue: {
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryLabel: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topButton: {
    flex: 1,
    borderColor: '#111',
  },
  modeSwitch: {
    flexDirection: 'row',
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  modeButtonActive: {
    backgroundColor: '#FFD84D',
  },
  modeButtonText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  modeButtonTextActive: {
    color: '#111',
  },
  priceSyncPanel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  priceSyncCopy: {
    flex: 1,
    gap: 2,
  },
  priceSyncTitle: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },
  priceSyncText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '800',
  },
  priceSyncButton: {
    minWidth: 104,
    borderColor: '#111',
    paddingHorizontal: 8,
  },
  input: {
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    minWidth: '31%',
    flexGrow: 1,
    borderColor: '#111',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  filterButtonLabel: {
    fontSize: 11,
  },
  message: {
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FF6B9E',
    color: '#111',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  empty: {
    color: '#F7FBFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  bulkHint: {
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  bulkCount: {
    color: '#F7FBFF',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  results: {
    gap: 10,
  },
  bulkRow: {
    gap: 8,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  bulkCardInfo: {
    gap: 2,
  },
  inventoryRow: {
    gap: 6,
    borderWidth: 2,
    borderColor: '#17344E',
    borderRadius: 9,
    padding: 7,
    backgroundColor: '#0B1D30',
  },
  inventoryMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  inventoryThumbnail: {
    width: 46,
    aspectRatio: 0.716,
    borderWidth: 1,
    borderColor: '#2A587A',
    borderRadius: 5,
    backgroundColor: '#17344E',
  },
  inventoryInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  inventoryTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  typeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 18,
    borderRadius: 5,
    backgroundColor: '#1D5D86',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  typeLegend: {
    backgroundColor: '#6746B8',
  },
  typeChampion: {
    backgroundColor: '#9C3C86',
  },
  typeBattlefield: {
    backgroundColor: '#3F766B',
  },
  typeSpell: {
    backgroundColor: '#1D5D86',
  },
  typeGear: {
    backgroundColor: '#8A6B25',
  },
  typeUnit: {
    backgroundColor: '#2C6D54',
  },
  inventoryType: {
    color: '#F7FBFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  inventoryMeta: {
    color: '#82B7EA',
    fontSize: 10,
    fontWeight: '900',
  },
  inventoryNameLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  rarityIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  rarityIconText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  rarityLegendary: {
    backgroundColor: '#D49A11',
  },
  rarityEpic: {
    backgroundColor: '#C142B5',
  },
  rarityRare: {
    backgroundColor: '#3D90D8',
  },
  rarityUncommon: {
    backgroundColor: '#58B887',
  },
  rarityCommon: {
    backgroundColor: '#7B8794',
  },
  totalQuantity: {
    minWidth: 15,
    color: '#F7FBFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  inventoryName: {
    flex: 1,
    minWidth: 0,
    color: '#82B7EA',
    fontSize: 16,
    fontWeight: '800',
  },
  inventoryPriceBlock: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 70,
    gap: 5,
  },
  trendPrice: {
    color: '#F7FBFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  colorIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#557085',
  },
  colorIconText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  colorCalm: {
    backgroundColor: '#71B96B',
  },
  colorFury: {
    backgroundColor: '#CB4A3D',
  },
  colorChaos: {
    backgroundColor: '#B43A9D',
  },
  colorMind: {
    backgroundColor: '#278DC4',
  },
  colorBody: {
    backgroundColor: '#D0822F',
  },
  colorOrder: {
    backgroundColor: '#D7C359',
  },
  colorNeutral: {
    backgroundColor: '#8291A1',
  },
  inventoryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 54,
  },
  miniQuantityBox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
    borderColor: '#2A587A',
    borderRadius: 7,
    padding: 3,
    backgroundColor: '#102A43',
  },
  miniQuantityLabel: {
    color: '#F7FBFF',
    fontSize: 10,
    fontWeight: '900',
  },
  miniQuantityValue: {
    minWidth: 16,
    color: '#F7FBFF',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  miniStepper: {
    minWidth: 26,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  miniStepperLabel: {
    fontSize: 11,
  },
  compactCardmarketButton: {
    minWidth: 42,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  compactCardmarketButtonLabel: {
    fontSize: 10,
  },
  rowCard: {
    gap: 9,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  rowMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  thumbnail: {
    width: 58,
    aspectRatio: 0.716,
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 7,
    backgroundColor: '#ddd',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },
  subMeta: {
    color: '#333',
    fontSize: 11,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  metricBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 3,
    backgroundColor: '#EAFBFF',
  },
  metricHighlight: {
    backgroundColor: '#FFD84D',
  },
  metricLabel: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  quantityGrid: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulkQuantityGrid: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quantityBox: {
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: 132,
    minWidth: 132,
    flexDirection: 'row',
    gap: 5,
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 9,
    padding: 5,
    backgroundColor: '#FFD84D',
  },
  quantityLabel: {
    minWidth: 12,
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },
  quantityValue: {
    minWidth: 22,
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepper: {
    minWidth: 34,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  stepperLabel: {
    fontSize: 13,
  },
  cardmarketButton: {
    flexGrow: 1,
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cardmarketButtonLabel: {
    fontSize: 12,
  },
  loadMoreButton: {
    alignSelf: 'center',
    minWidth: 160,
    borderColor: '#111',
  },
});
