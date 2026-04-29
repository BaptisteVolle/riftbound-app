import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import {
  CardmarketPriceCacheStatus,
  forceRefreshCardmarketPriceData,
  formatPriceCacheAge,
  formatRefreshWaitTime,
  getCardmarketPriceCacheStatus,
} from '../src/features/cardmarket/cardmarket-prices.service';
import {
  addCardToCollection,
  getCollection,
  getCollectionTotals,
  removeCardFromCollection,
} from '../src/features/collection/collection.service';
import { CollectionEntry, CollectionPrinting } from '../src/features/collection/collection.types';
import {
  buildCardmarketSearchUrl,
  getOpenableCardmarketUrlForCard,
} from '../src/features/cards/cards.service';
import { formatCardMeta } from '../src/lib/utils';

export default function CollectionScreen() {
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [query, setQuery] = useState('');
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

  const totals = useMemo(() => getCollectionTotals(collection), [collection]);
  const filteredCollection = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return collection;
    }

    return collection.filter((entry) => {
      const haystack = `${entry.card.name} ${entry.card.set} ${entry.card.setCode} ${entry.card.number} ${entry.card.rarity ?? ''}`
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [collection, query]);

  async function changeQuantity(
    entry: CollectionEntry,
    printing: CollectionPrinting,
    delta: number,
  ) {
    setMessage('');

    if (delta > 0) {
      await addCardToCollection(entry.card, printing);
    } else {
      await removeCardFromCollection(entry.cardKey, printing);
    }

    await loadCollection();
  }

  async function openPrice(entry: CollectionEntry) {
    setMessage('Checking Cardmarket page...');

    const resolvedUrl = await getOpenableCardmarketUrlForCard(entry.card);
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
      </View>

      <View style={styles.topActions}>
        <Button label="SCAN" tone="orange" style={styles.topButton} onPress={() => router.push('/scan')} />
        <Button label="SEARCH" tone="gold" style={styles.topButton} onPress={() => router.push('/search')} />
      </View>

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
        placeholder="Filter by name, set, number..."
        placeholderTextColor="#555"
        style={styles.input}
        value={query}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {isLoading ? <Text style={styles.empty}>Loading collection...</Text> : null}
      {!isLoading && collection.length === 0 ? (
        <Text style={styles.empty}>No cards yet. Scan one and add it here.</Text>
      ) : null}

      <View style={styles.results}>
        {filteredCollection.map((entry) => (
          <View key={entry.cardKey} style={styles.card}>
            {entry.card.imageUrl ? (
              <Image source={{ uri: entry.card.imageUrl }} style={styles.image} />
            ) : null}
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{entry.card.name}</Text>
              <Text style={styles.meta}>{formatCardMeta(entry.card.setCode, entry.card.number)}</Text>
              <Text style={styles.subMeta}>
                {entry.card.rarity ?? entry.card.type} - {entry.condition} - {entry.language}
              </Text>
            </View>

            <View style={styles.quantityGrid}>
              <QuantityControl
                label="NORMAL"
                value={entry.normalQuantity}
                onIncrement={() => changeQuantity(entry, 'normal', 1)}
                onDecrement={() => changeQuantity(entry, 'normal', -1)}
              />
              <QuantityControl
                label="FOIL"
                value={entry.foilQuantity}
                onIncrement={() => changeQuantity(entry, 'foil', 1)}
                onDecrement={() => changeQuantity(entry, 'foil', -1)}
              />
            </View>

            <Button label="OPEN CARDMARKET" tone="blue" onPress={() => openPrice(entry)} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
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
      <View style={styles.quantityRow}>
        <Button disabled={value === 0} label="-" tone="dark" style={styles.stepper} onPress={onDecrement} />
        <Text style={styles.quantityValue}>{value}</Text>
        <Button label="+" tone="dark" style={styles.stepper} onPress={onIncrement} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 24,
    paddingBottom: 42,
    backgroundColor: '#7EE7FF',
  },
  title: {
    color: '#111',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  summary: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFD84D',
    shadowColor: '#111',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  summaryValue: {
    color: '#111',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryLabel: {
    color: '#111',
    fontSize: 12,
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
  priceSyncPanel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fff',
    shadowColor: '#111',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
    minWidth: 112,
    borderColor: '#111',
    paddingHorizontal: 10,
  },
  input: {
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
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
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  results: {
    gap: 14,
  },
  card: {
    gap: 12,
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#fff',
    shadowColor: '#111',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  image: {
    width: '100%',
    aspectRatio: 0.716,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    backgroundColor: '#ddd',
  },
  cardBody: {
    gap: 4,
  },
  cardName: {
    color: '#111',
    fontSize: 22,
    fontWeight: '900',
  },
  meta: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
  },
  subMeta: {
    color: '#333',
    fontSize: 13,
    fontWeight: '800',
  },
  quantityGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quantityBox: {
    flex: 1,
    gap: 8,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FFD84D',
  },
  quantityLabel: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  quantityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  quantityValue: {
    minWidth: 30,
    color: '#111',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepper: {
    minWidth: 42,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
});
