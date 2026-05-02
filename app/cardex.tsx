import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { CardIdentityRow } from '../src/components/CardIdentityRow';
import { DropdownSelect } from '../src/components/DropdownSelect';
import {
  formatCardmarketPrice,
  getCardmarketPriceForCard,
  getDisplayPrice,
} from '../src/features/cardmarket/cardmarket-prices.service';
import { CardmarketPriceSummary } from '../src/features/cardmarket/cardmarket.types';
import {
  CardexVariantFilter,
  REAL_CARDEX_SET_CODES,
  getCardexCards,
  isBattlefieldCard,
  matchesCardexFilters,
} from '../src/features/cards/cards.service';
import { RiftboundCard } from '../src/features/cards/cards.types';
import { getCollection, getCollectionCardKey } from '../src/features/collection/collection.service';
import { CollectionEntry } from '../src/features/collection/collection.types';

const CARDEX_PAGE_SIZE = 24;
const VARIANT_FILTER_OPTIONS: CardexVariantFilter[] = ['ALL', 'BASE', 'ALTERNATE', 'OVERNUMBERED', 'SIGNATURE'];
type CardexRouteParams = {
  query?: string;
  ownedOnly?: string;
  setFilter?: string;
  typeFilter?: string;
  variantFilter?: string;
};

type OwnershipSummary = {
  normal: number;
  foil: number;
  total: number;
};

function getOwnershipMap(collection: CollectionEntry[]) {
  return new Map(
    collection.map((entry) => [
      entry.cardKey,
      {
        normal: entry.normalQuantity,
        foil: entry.foilQuantity,
        total: entry.normalQuantity + entry.foilQuantity,
      },
    ]),
  );
}

function toDropdownOptions<TValue extends string>(values: readonly TValue[]) {
  return values.map((value) => ({
    label: value === 'ALL' ? 'All' : value,
    value,
  }));
}

export default function CardexScreen() {
  const params = useLocalSearchParams<CardexRouteParams>();
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [pricesByKey, setPricesByKey] = useState<Record<string, CardmarketPriceSummary | undefined>>({});
  const [loadedPriceKeys, setLoadedPriceKeys] = useState<Record<string, true>>({});
  const [hoveredCardId, setHoveredCardId] = useState('');
  const [visibleCount, setVisibleCount] = useState(CARDEX_PAGE_SIZE);
  const [isCollectionLoading, setIsCollectionLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [setFilter, setSetFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [variantFilter, setVariantFilter] = useState<CardexVariantFilter>('ALL');

  useEffect(() => {
    setQuery(typeof params.query === 'string' ? params.query : '');
    setOwnedOnly(params.ownedOnly === 'true');
    setSetFilter(typeof params.setFilter === 'string' ? params.setFilter : 'ALL');
    setTypeFilter(typeof params.typeFilter === 'string' ? params.typeFilter : 'ALL');
    setVariantFilter(
      typeof params.variantFilter === 'string'
        ? (params.variantFilter as CardexVariantFilter)
        : 'ALL',
    );
  }, [params.ownedOnly, params.query, params.setFilter, params.typeFilter, params.variantFilter]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setIsCollectionLoading(true);

      getCollection()
        .then((entries) => {
          if (isActive) {
            setCollection(entries);
          }
        })
        .catch(() => {
          if (isActive) {
            setCollection([]);
          }
        })
        .finally(() => {
          if (isActive) {
            setIsCollectionLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  const cards = getCardexCards();
  const ownershipByKey = useMemo(() => getOwnershipMap(collection), [collection]);
  const setCodes = useMemo(() => {
    return ['ALL', ...REAL_CARDEX_SET_CODES];
  }, []);
  const typeOptions = useMemo(() => {
    return ['ALL', ...new Set(cards.map((card) => card.type).sort((a, b) => a.localeCompare(b)))];
  }, [cards]);
  const setDropdownOptions = useMemo(() => toDropdownOptions(setCodes), [setCodes]);
  const typeDropdownOptions = useMemo(() => toDropdownOptions(typeOptions), [typeOptions]);
  const variantDropdownOptions = useMemo(() => toDropdownOptions(VARIANT_FILTER_OPTIONS), []);
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const ownership = ownershipByKey.get(getCollectionCardKey(card));

      if (ownedOnly && !ownership?.total) {
        return false;
      }

      return matchesCardexFilters(card, {
        query,
        setFilter,
        typeFilter,
        variantFilter,
      });
    });
  }, [cards, ownedOnly, ownershipByKey, query, setFilter, typeFilter, variantFilter]);
  const visibleCards = useMemo(() => {
    return filteredCards.slice(0, visibleCount);
  }, [filteredCards, visibleCount]);

  useEffect(() => {
    setVisibleCount(CARDEX_PAGE_SIZE);
  }, [ownedOnly, query, setFilter, typeFilter, variantFilter]);

  useEffect(() => {
    let isActive = true;
    const cardsMissingPrices = visibleCards.filter((card) => {
      return !loadedPriceKeys[getCollectionCardKey(card)];
    });

    if (cardsMissingPrices.length === 0) {
      return () => {
        isActive = false;
      };
    }

    setIsPriceLoading(true);

    Promise.all(
      cardsMissingPrices.map(async (card) => {
        const key = getCollectionCardKey(card);
        const price = await getCardmarketPriceForCard(card).catch(() => undefined);
        return [key, price] as const;
      }),
    ).then((entries) => {
      if (isActive) {
        setPricesByKey((currentPrices) => ({
          ...currentPrices,
          ...Object.fromEntries(entries),
        }));
        setLoadedPriceKeys((currentKeys) => {
          const nextKeys = { ...currentKeys };
          entries.forEach(([key]) => {
            nextKeys[key] = true;
          });
          return nextKeys;
        });
      }
    }).finally(() => {
      if (isActive) {
        setIsPriceLoading(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadedPriceKeys, visibleCards]);

  function openCard(card: RiftboundCard) {
    router.push({
      pathname: '/card/[id]',
      params: {
        id: card.id,
        context: 'cardex',
        ownedOnly: ownedOnly ? 'true' : '',
        query,
        setFilter,
        typeFilter,
        variantFilter,
      },
    });
  }

  function updateCardexRoute({
    nextOwnedOnly = ownedOnly,
    nextQuery = query,
    nextSetFilter = setFilter,
    nextTypeFilter = typeFilter,
    nextVariantFilter = variantFilter,
  }: {
    nextOwnedOnly?: boolean;
    nextQuery?: string;
    nextSetFilter?: string;
    nextTypeFilter?: string;
    nextVariantFilter?: string;
  }) {
    setOwnedOnly(nextOwnedOnly);
    setQuery(nextQuery);
    setSetFilter(nextSetFilter);
    setTypeFilter(nextTypeFilter);
    setVariantFilter(nextVariantFilter as CardexVariantFilter);

    router.setParams({
      ownedOnly: nextOwnedOnly ? 'true' : '',
      query: nextQuery,
      setFilter: nextSetFilter,
      typeFilter: nextTypeFilter,
      variantFilter: nextVariantFilter,
    });
  }

  function resetFilters() {
    updateCardexRoute({
      nextOwnedOnly: false,
      nextQuery: '',
      nextSetFilter: 'ALL',
      nextTypeFilter: 'ALL',
      nextVariantFilter: 'ALL',
    });
  }

  return (
    <FlatList
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>CARDEX</Text>
          <Text style={styles.subtitle}>
            {visibleCards.length} / {filteredCards.length} cards - {collection.length} owned entries
          </Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => {
              updateCardexRoute({ nextQuery: value });
            }}
            placeholder="Filter cards..."
            placeholderTextColor="#555"
            style={styles.input}
            value={query}
          />

          <View style={styles.filterRow}>
            <Button
              label={ownedOnly ? 'OWNED ONLY' : 'ALL CARDS'}
              tone={ownedOnly ? 'orange' : 'gold'}
              style={styles.filterButton}
              onPress={() => {
                updateCardexRoute({ nextOwnedOnly: !ownedOnly });
              }}
            />
            <Button label="RESET" tone="dark" style={styles.filterButton} onPress={resetFilters} />
          </View>
          <View style={styles.dropdownGrid}>
            <DropdownSelect
              label="Set"
              onChange={(value) => updateCardexRoute({ nextSetFilter: value })}
              options={setDropdownOptions}
              value={setFilter}
            />
            <DropdownSelect
              label="Type"
              onChange={(value) => updateCardexRoute({ nextTypeFilter: value })}
              options={typeDropdownOptions}
              value={typeFilter}
            />
            <DropdownSelect
              label="Variant"
              onChange={(value) => updateCardexRoute({ nextVariantFilter: value })}
              options={variantDropdownOptions}
              value={variantFilter}
            />
          </View>

          {isCollectionLoading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color="#111" size="small" />
              <Text style={styles.loadingText}>Loading Cardex...</Text>
            </View>
          ) : null}
        </View>
      }
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.container}
      data={visibleCards}
      initialNumToRender={CARDEX_PAGE_SIZE}
      keyExtractor={(card) => card.id}
      ListFooterComponent={
        <CardexFooter
          hasMore={visibleCount < filteredCards.length}
          isLoadingPrices={isPriceLoading}
          onLoadMore={() => {
            setVisibleCount((currentCount) => {
              return Math.min(filteredCards.length, currentCount + CARDEX_PAGE_SIZE);
            });
          }}
        />
      }
      numColumns={2}
      onEndReached={() => {
        if (visibleCount < filteredCards.length) {
          setVisibleCount((currentCount) => {
            return Math.min(filteredCards.length, currentCount + CARDEX_PAGE_SIZE);
          });
        }
      }}
      onEndReachedThreshold={0.65}
      renderItem={({ item: card }) => {
        const cardKey = getCollectionCardKey(card);
        const ownership = ownershipByKey.get(cardKey) ?? {
          normal: 0,
          foil: 0,
          total: 0,
        };
        const price = pricesByKey[cardKey];
        const isPriceReady = Boolean(loadedPriceKeys[cardKey]);
        const pricePrinting = ownership.foil > 0 && ownership.normal === 0 ? 'foil' : 'normal';
        const trendPrice = getDisplayPrice(price, 'trend', pricePrinting);

        return (
          <Pressable
            onHoverIn={() => setHoveredCardId(card.id)}
            onHoverOut={() => setHoveredCardId('')}
            onPress={() => openCard(card)}
            style={({ pressed }) => [
              styles.card,
              ownership.total === 0 && styles.unownedCard,
              hoveredCardId === card.id && styles.cardHovered,
              pressed && styles.cardPressed,
            ]}
          >
            {card.imageUrl ? (
              <View style={styles.imageFrame}>
                <Image
                  source={{ uri: card.imageUrl }}
                  style={[
                    styles.image,
                    isBattlefieldCard(card) && styles.battlefieldImage,
                  ]}
                />
                <View style={styles.trendTag}>
                  <Text style={styles.trendTagLabel}>Trend</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.trendTagValue}>
                    {isPriceReady ? formatCardmarketPrice(trendPrice) : '...'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.imageFrame, styles.imagePlaceholder]}>
                <View style={styles.trendTag}>
                  <Text style={styles.trendTagLabel}>Trend</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.trendTagValue}>
                    {isPriceReady ? formatCardmarketPrice(trendPrice) : '...'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.cardInfoBlock}>
              <CardIdentityRow card={card} compact showImage={false} textTone="dark" />
              <Text
                numberOfLines={1}
                style={[
                  styles.ownedState,
                  ownership.total === 0 && styles.missingState,
                ]}
              >
                {ownership.total > 0 ? 'OWNED' : 'NOT OWNED'}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function CardexFooter({
  hasMore,
  isLoadingPrices,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoadingPrices: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore && !isLoadingPrices) {
    return null;
  }

  return (
    <View style={styles.footer}>
      {isLoadingPrices ? (
        <>
          <ActivityIndicator color="#111" size="small" />
          <Text style={styles.footerText}>Loading prices...</Text>
        </>
      ) : null}
      {hasMore ? (
        <Button
          label="LOAD MORE"
          tone="blue"
          style={styles.loadMoreButton}
          labelStyle={styles.loadMoreButtonLabel}
          onPress={onLoadMore}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 14,
    paddingTop: 58,
    paddingBottom: 42,
    backgroundColor: '#071527',
  },
  header: {
    gap: 14,
  },
  title: {
    color: '#F8F0DC',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#F8F0DC',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  input: {
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    flex: 1,
    borderColor: '#111',
    paddingHorizontal: 8,
  },
  dropdownGrid: {
    gap: 8,
  },
  loadingPanel: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  loadingText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
  gridRow: {
    gap: 12,
  },
  card: {
    flex: 1,
    maxWidth: '50%',
    gap: 9,
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 14,
    padding: 9,
    backgroundColor: '#fff',
    shadowColor: '#FFD84D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  unownedCard: {},
  cardPressed: {
    transform: [{ scale: 0.98 }, { translateY: 2 }],
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  cardHovered: {
    transform: [{ translateY: -3 }],
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 0.716,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 10,
    backgroundColor: '#ddd',
    overflow: 'hidden',
  },
  trendTag: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    minWidth: 66,
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#FFD84D',
  },
  trendTagLabel: {
    color: '#111',
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  trendTagValue: {
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  battlefieldImage: {
    transform: [{ rotate: '180deg' }],
  },
  imagePlaceholder: {
    backgroundColor: '#ddd',
  },
  cardInfoBlock: {
    minHeight: 46,
    gap: 3,
  },
  ownedState: {
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 5,
    backgroundColor: '#7EE7FF',
    color: '#111',
    fontSize: 8,
    fontWeight: '900',
  },
  missingState: {
    backgroundColor: '#FF6B9E',
  },
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  footerText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
  loadMoreButton: {
    minWidth: 150,
    borderColor: '#111',
  },
  loadMoreButtonLabel: {
    fontSize: 13,
  },
});
