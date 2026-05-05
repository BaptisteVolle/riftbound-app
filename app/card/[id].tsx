import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Button } from "../../src/components/Button";
import {
  formatCardmarketPrice,
  getCardmarketPriceForCard,
  getDisplayPrice,
} from "../../src/features/cardmarket/cardmarket-prices.service";
import { CardmarketPriceSummary } from "../../src/features/cardmarket/cardmarket.types";
import {
  buildCardmarketSearchUrl,
  buildCardmarketUrlForCard,
  getAllCards,
  getCardexCards,
  getCardById,
  getOpenableCardmarketUrlForCard,
  isBattlefieldCard,
  matchesCardexFilters,
} from "../../src/features/cards/cards.service";
import { RiftboundCard } from "../../src/features/cards/cards.types";
import {
  addCardToCollection,
  getCollection,
  getCollectionCardKey,
  removeCardFromCollection,
} from "../../src/features/collection/collection.service";
import {
  CollectionEntry,
  CollectionPrinting,
} from "../../src/features/collection/collection.types";
import { isFoilLockedCard } from "../../src/features/scan/scan-logic/scan-text.service";
import { formatCardMeta } from "../../src/lib/utils";

type CardRouteParams = {
  id: string;
  ids?: string;
  context?: string;
  query?: string;
  setFilter?: string;
  typeFilter?: string;
  variantFilter?: string;
  ownedOnly?: string;
  name?: string;
  set?: string;
  setCode?: string;
  number?: string;
  color?: string;
  cost?: string;
  type?: string;
  rarity?: string;
  alternateArt?: string;
  overnumbered?: string;
  signature?: string;
  matchConfidence?: "exact" | "name-only" | "collector-only" | "";
  imageUrl?: string;
};

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

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

function getFallbackCard(
  params: Partial<Record<keyof CardRouteParams, string | string[]>>,
) {
  const id = getParamValue(params.id);
  const name = getParamValue(params.name);
  const setCode = getParamValue(params.setCode);
  const number = getParamValue(params.number);

  if (!id || !name || !setCode || !number) {
    return undefined;
  }

  const matchConfidence = getParamValue(params.matchConfidence);

  return {
    id,
    name,
    set: getParamValue(params.set) ?? setCode,
    setCode,
    number,
    color: getParamValue(params.color) ?? "Unknown",
    cost: Number(getParamValue(params.cost) ?? 0),
    type: getParamValue(params.type) ?? "Card",
    rarity: getParamValue(params.rarity) || undefined,
    alternateArt: getParamValue(params.alternateArt) === "true",
    overnumbered: getParamValue(params.overnumbered) === "true",
    signature: getParamValue(params.signature) === "true",
    matchConfidence:
      matchConfidence === "exact" ||
      matchConfidence === "name-only" ||
      matchConfidence === "collector-only"
        ? matchConfidence
        : undefined,
    imageUrl: getParamValue(params.imageUrl) || undefined,
  } satisfies RiftboundCard;
}

export default function CardDetailScreen() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<RiftboundCard>>(null);
  const [message, setMessage] = useState("");
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [pricesByKey, setPricesByKey] = useState<
    Record<string, CardmarketPriceSummary | undefined>
  >({});
  const params = useLocalSearchParams<CardRouteParams>();
  const selectedId = getParamValue(params.id);
  const allCards = getAllCards();
  const cardexCards = getCardexCards();
  const ownershipByKey = useMemo(
    () => getOwnershipMap(collection),
    [collection],
  );
  const context = getParamValue(params.context);
  const cardexQuery = getParamValue(params.query)?.trim().toLowerCase() ?? "";
  const cardexSetFilter = getParamValue(params.setFilter) ?? "ALL";
  const cardexTypeFilter = getParamValue(params.typeFilter) ?? "ALL";
  const cardexVariantFilter = getParamValue(params.variantFilter) ?? "ALL";
  const cardexOwnedOnly = getParamValue(params.ownedOnly) === "true";
  const contextIds = useMemo(() => {
    return getParamValue(params.ids)?.split(",").filter(Boolean) ?? [];
  }, [params.ids]);
  const cards = useMemo(() => {
    if (context === "cardex" || context === "catalog") {
      const filteredCardexCards = cardexCards.filter((card) => {
        const ownership = ownershipByKey.get(getCollectionCardKey(card));

        if (cardexOwnedOnly && !ownership?.total) {
          return false;
        }

        return matchesCardexFilters(card, {
          query: cardexQuery,
          setFilter: cardexSetFilter,
          typeFilter: cardexTypeFilter,
          variantFilter: cardexVariantFilter,
        });
      });

      if (filteredCardexCards.length > 0) {
        return filteredCardexCards;
      }
    }

    const contextCards = contextIds
      .map((id) => getCardById(id))
      .filter((card): card is RiftboundCard => Boolean(card));

    if (contextCards.length > 0) {
      return contextCards;
    }

    const localCard = selectedId ? getCardById(selectedId) : undefined;
    const fallbackCard = getFallbackCard(params);

    if (localCard) {
      return [localCard];
    }

    if (fallbackCard) {
      return [fallbackCard];
    }

    return allCards;
  }, [
    allCards,
    cardexCards,
    cardexOwnedOnly,
    cardexQuery,
    cardexSetFilter,
    cardexTypeFilter,
    cardexVariantFilter,
    context,
    contextIds,
    ownershipByKey,
    params,
    selectedId,
  ]);
  const initialIndex = Math.max(
    0,
    cards.findIndex((card) => card.id === selectedId),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const activeCard = cards[currentIndex] ?? cards[initialIndex] ?? cards[0];

  useEffect(() => {
    setCurrentIndex(initialIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    });
  }, [cards.length, initialIndex]);

  useEffect(() => {
    let isActive = true;

    Promise.all(
      cards.map(async (card) => {
        const key = getCollectionCardKey(card);
        const price = await getCardmarketPriceForCard(card).catch(
          () => undefined,
        );
        return [key, price] as const;
      }),
    ).then((entries) => {
      if (isActive) {
        setPricesByKey(Object.fromEntries(entries));
      }
    });

    return () => {
      isActive = false;
    };
  }, [cards]);

  const loadCollection = useCallback(async () => {
    setCollection(await getCollection());
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

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
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  if (cards.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>CARD NOT FOUND</Text>
      </View>
    );
  }

  async function openCardmarket(card: RiftboundCard) {
    setMessage("Checking Cardmarket page...");

    const shouldUseDirectCardmarket =
      !card.matchConfidence || card.matchConfidence === "exact";
    const cardmarketPrinting = isFoilLockedCard(card) ? "foil" : "normal";
    const resolvedUrl = shouldUseDirectCardmarket
      ? await getOpenableCardmarketUrlForCard(card, {
          printing: cardmarketPrinting,
        })
      : undefined;
    const url =
      resolvedUrl?.url ??
      buildCardmarketUrlForCard(card, { printing: cardmarketPrinting }) ??
      buildCardmarketSearchUrl({ name: card.name });

    if (!url) {
      setMessage("No Cardmarket URL found for this card.");
      return;
    }

    setMessage(
      resolvedUrl?.mode === "search"
        ? "Exact page returned 404. Opening name search."
        : "",
    );
    Linking.openURL(url);
  }

  async function handleQuickAdd(
    card: RiftboundCard,
    printing: CollectionPrinting,
  ) {
    setMessage(`Adding ${printing} copy...`);

    try {
      await addCardToCollection(card, printing);
      await loadCollection();
      setMessage("");
    } catch {
      setMessage("Could not add this card to the collection.");
    }
  }

  async function handleQuickRemove(
    card: RiftboundCard,
    printing: CollectionPrinting,
  ) {
    setMessage(`Removing ${printing} copy...`);

    try {
      await removeCardFromCollection(getCollectionCardKey(card), printing);
      await loadCollection();
      setMessage("");
    } catch {
      setMessage("Could not remove this card from the collection.");
    }
  }

  function renderCard({ item }: { item: RiftboundCard }) {
    const ownership = ownershipByKey.get(getCollectionCardKey(item)) ?? {
      normal: 0,
      foil: 0,
      total: 0,
    };
    const price = pricesByKey[getCollectionCardKey(item)];
    const pricePrinting =
      isFoilLockedCard(item) || (ownership.foil > 0 && ownership.normal === 0)
        ? "foil"
        : "normal";
    return (
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        style={{ width }}
      >
        <View style={styles.imageWrap}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={[
                styles.image,
                isBattlefieldCard(item) && styles.battlefieldImage,
              ]}
            />
          ) : null}
        </View>
        <View style={styles.heroRow}>
          <Text numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
          <Text style={styles.meta}>
            {formatCardMeta(item.setCode, item.number)}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.ownershipBadge,
              ownership.total > 0 ? styles.ownedBadge : styles.missingBadge,
            ]}
          >
            {ownership.total > 0 ? "OWNED" : "NOT OWNED"}
          </Text>
        </View>

        <View style={styles.priceGrid}>
          <PriceChip
            label="Low"
            value={getDisplayPrice(price, "low", pricePrinting)}
          />
          <PriceChip
            label="Avg"
            value={getDisplayPrice(price, "avg", pricePrinting)}
          />
          <PriceChip
            label="Trend"
            value={getDisplayPrice(price, "trend", pricePrinting)}
          />
        </View>

        <View style={styles.quickAddPanel}>
          <View style={styles.quickCount}>
            <Text style={styles.quickCountLabel}>Normal</Text>
            <Text style={styles.quickCountValue}>{ownership.normal}</Text>
            <Button
              disabled={ownership.normal === 0}
              label="-"
              tone="dark"
              style={styles.quickAddButton}
              labelStyle={styles.quickAddButtonLabel}
              onPress={() => handleQuickRemove(item, "normal")}
            />
            <Button
              label="+"
              tone="dark"
              style={styles.quickAddButton}
              labelStyle={styles.quickAddButtonLabel}
              onPress={() => handleQuickAdd(item, "normal")}
            />
          </View>
          <View style={styles.quickCount}>
            <Text style={styles.quickCountLabel}>Foil</Text>
            <Text style={styles.quickCountValue}>{ownership.foil}</Text>
            <Button
              disabled={ownership.foil === 0}
              label="-"
              tone="dark"
              style={styles.quickAddButton}
              labelStyle={styles.quickAddButtonLabel}
              onPress={() => handleQuickRemove(item, "foil")}
            />
            <Button
              label="+"
              tone="dark"
              style={styles.quickAddButton}
              labelStyle={styles.quickAddButtonLabel}
              onPress={() => handleQuickAdd(item, "foil")}
            />
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  }

  const activeDirectCardmarketUrl =
    activeCard &&
    (!activeCard.matchConfidence || activeCard.matchConfidence === "exact")
      ? buildCardmarketUrlForCard(activeCard, {
          printing: isFoilLockedCard(activeCard) ? "foil" : "normal",
        })
      : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Button
          label="BACK"
          tone="dark"
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }

            router.replace("/cardex");
          }}
        />

        <Text style={styles.counter}>
          {currentIndex + 1} / {cards.length}
        </Text>
      </View>
      <Text style={styles.counter}>
        {currentIndex + 1} / {cards.length}
      </Text>
      <FlatList
        data={cards}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        horizontal
        initialScrollIndex={initialIndex}
        keyExtractor={(card) => card.id}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(
            event.nativeEvent.contentOffset.x / width,
          );
          setCurrentIndex(Math.max(0, Math.min(cards.length - 1, nextIndex)));
          setMessage("");
        }}
        onScrollToIndexFailed={() => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({
              index: initialIndex,
              animated: false,
            });
          });
        }}
        pagingEnabled
        ref={listRef}
        renderItem={renderCard}
        showsHorizontalScrollIndicator={false}
      />
      {activeCard ? (
        <View style={styles.bottomBar}>
          <Button
            label={
              activeDirectCardmarketUrl
                ? "OPEN CARDMARKET"
                : "SEARCH CARDMARKET"
            }
            onPress={() => openCardmarket(activeCard)}
            tone="pink"
            style={styles.bottomCardmarketButton}
          />
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

function PriceChip({ label, value }: { label: string; value?: number | null }) {
  return (
    <View style={styles.priceChip}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{formatCardmarketPrice(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071527",
  },
  page: {
    gap: 14,
    padding: 18,
    paddingBottom: 112,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#7EE7FF",
  },

  imageWrap: {
    alignItems: "center",
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 2,
    borderColor: "#F2B84B",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#123F6D",
  },
  image: {
    width: "82%",
    maxWidth: 360,
    aspectRatio: 0.716,
    borderWidth: 2,
    borderColor: "#F8F0DC",
    borderRadius: 12,
    backgroundColor: "#092A4C",
  },
  battlefieldImage: {
    transform: [{ rotate: "180deg" }],
  },
  name: {
    flex: 1,
    color: "#F8F0DC",
    fontSize: 16,
    fontWeight: "900",
  },
  meta: {
    color: "#F2B84B",
    fontSize: 13,
    fontWeight: "900",
  },
  title: {
    color: "#111",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  ownershipBadge: {
    borderWidth: 2,
    borderColor: "#F8F0DC",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#092A4C",
    color: "#F8F0DC",
    fontSize: 10,
    fontWeight: "900",
  },
  ownedBadge: {
    backgroundColor: "#1F6F9F",
  },
  missingBadge: {
    backgroundColor: "#E66A2C",
  },
  priceGrid: {
    flexDirection: "row",
    gap: 8,
  },
  priceChip: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#F8F0DC",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 5,
    backgroundColor: "#092A4C",
  },
  priceLabel: {
    color: "#F2B84B",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  priceValue: {
    color: "#F8F0DC",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  quickAddPanel: {
    flexDirection: "row",
    gap: 8,
  },
  quickCount: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    borderWidth: 2,
    borderColor: "#F8F0DC",
    borderRadius: 10,
    padding: 7,
    backgroundColor: "#092A4C",
  },
  quickCountLabel: {
    flex: 1,
    color: "#F2B84B",
    fontSize: 12,
    fontWeight: "900",
  },
  quickCountValue: {
    minWidth: 24,
    color: "#F8F0DC",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  quickAddButton: {
    minWidth: 32,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  quickAddButtonLabel: {
    fontSize: 15,
  },
  bottomSpacer: {
    height: 6,
  },
  bottomBar: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    borderTopWidth: 2,
    borderTopColor: "rgba(248, 240, 220, 0.35)",
    padding: 14,
    paddingBottom: 24,
    backgroundColor: "rgba(7, 21, 39, 0.98)",
  },
  bottomCardmarketButton: {
    borderColor: "#F8F0DC",
  },
  message: {
    position: "absolute",
    right: 18,
    bottom: 104,
    left: 18,
    borderWidth: 2,
    borderColor: "#F8F0DC",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#E66A2C",
    color: "#F8F0DC",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingTop: 52,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },

  backButton: {
    minWidth: 82,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  counter: {
    flex: 1,
    color: "#F8F0DC",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    paddingRight: 82,
  },
});
