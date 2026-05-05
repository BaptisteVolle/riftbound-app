import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatCardmarketPrice,
  getCardmarketPriceForCard,
} from "../../cardmarket/cardmarket-prices.service";
import type { CardmarketPriceSummary } from "../../cardmarket/cardmarket.types";
import {
  REAL_CARDEX_SET_CODES,
  getCardexCards,
} from "../../cards/cards.service";
import type { RiftboundCard } from "../../cards/cards.types";
import {
  getCollection,
  getCollectionCardKey,
} from "../../collection/collection.service";
import type { CollectionEntry } from "../../collection/collection.types";
import {
  cardMatchesCardexFilters,
  getOptionValues,
  toDropdownOptions,
} from "../cardex-filter.service";
import {
  getCardexFiltersFromParams,
  getCardexSortFromParams,
  toCardexRouteParams,
} from "../cardex-route.service";
import { sortCardexCards } from "../cardex-sort.service";
import type {
  CardexFilters,
  CardexOptionModels,
  CardexOwnershipSummary,
  CardexRouteParams,
  CardexSortState,
} from "../cardex.types";
import { CARDEX_PAGE_SIZE, CARDEX_SORT_OPTIONS } from "../cardex.types";

function getOwnershipMap(collection: CollectionEntry[]) {
  return new Map<string, CardexOwnershipSummary>(
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

export function useCardexScreenState() {
  const params = useLocalSearchParams<CardexRouteParams>();

  const cards = useMemo(() => getCardexCards(), []);
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [pricesByKey, setPricesByKey] = useState<
    Record<string, CardmarketPriceSummary | undefined>
  >({});
  const [loadedPriceKeys, setLoadedPriceKeys] = useState<Record<string, true>>(
    {},
  );
  const [visibleCount, setVisibleCount] = useState(CARDEX_PAGE_SIZE);
  const [isCollectionLoading, setIsCollectionLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  const [filters, setFilters] = useState<CardexFilters>(() =>
    getCardexFiltersFromParams(params),
  );
  const [sort, setSort] = useState<CardexSortState>(() =>
    getCardexSortFromParams(params),
  );

  useEffect(() => {
    setFilters(getCardexFiltersFromParams(params));
    setSort(getCardexSortFromParams(params));
  }, [
    params.colorFilter,
    params.ownedOnly,
    params.query,
    params.rarityFilter,
    params.setFilter,
    params.sortDirection,
    params.sortKey,
    params.typeFilter,
  ]);

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

  const ownershipByKey = useMemo(() => {
    return getOwnershipMap(collection);
  }, [collection]);

  const optionModels = useMemo<CardexOptionModels>(() => {
    const colors = getOptionValues(
      cards.flatMap((card) =>
        card.colors?.length ? card.colors : [card.color],
      ),
    );

    const types = getOptionValues(cards.map((card) => card.type));
    const rarities = getOptionValues(
      cards.map((card) => card.rarity ?? "Unknown"),
    );

    return {
      setOptions: toDropdownOptions(["ALL", ...REAL_CARDEX_SET_CODES]),
      colorOptions: toDropdownOptions(colors),
      typeOptions: toDropdownOptions(types),
      rarityOptions: toDropdownOptions(rarities),
      sortOptions: CARDEX_SORT_OPTIONS.map((value) => ({
        value,
        label:
          value === "set"
            ? "Set / Number"
            : value === "price"
              ? "Price"
              : value.toUpperCase(),
      })),
    };
  }, [cards]);

  const filteredCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      const ownership = ownershipByKey.get(getCollectionCardKey(card));

      if (filters.ownedOnly && !ownership?.total) {
        return false;
      }

      return cardMatchesCardexFilters(card, filters);
    });

    return sortCardexCards({
      cards: filtered,
      pricesByKey,
      sortDirection: sort.sortDirection,
      sortKey: sort.sortKey,
    });
  }, [cards, filters, ownershipByKey, pricesByKey, sort]);

  const visibleCards = useMemo(() => {
    return filteredCards.slice(0, visibleCount);
  }, [filteredCards, visibleCount]);

  const cardsNeedingPrices = useMemo(() => {
    const sourceCards = sort.sortKey === "price" ? filteredCards : visibleCards;

    return sourceCards.filter((card) => {
      return !loadedPriceKeys[getCollectionCardKey(card)];
    });
  }, [filteredCards, loadedPriceKeys, sort.sortKey, visibleCards]);

  useEffect(() => {
    setVisibleCount(CARDEX_PAGE_SIZE);
  }, [filters, sort]);

  useEffect(() => {
    let isActive = true;

    if (cardsNeedingPrices.length === 0) {
      return () => {
        isActive = false;
      };
    }

    setIsPriceLoading(true);

    Promise.all(
      cardsNeedingPrices.map(async (card) => {
        const key = getCollectionCardKey(card);
        const price = await getCardmarketPriceForCard(card).catch(
          () => undefined,
        );

        return [key, price] as const;
      }),
    )
      .then((entries) => {
        if (!isActive) {
          return;
        }

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
      })
      .finally(() => {
        if (isActive) {
          setIsPriceLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [cardsNeedingPrices]);

  function setRouteState(
    nextFilters: CardexFilters,
    nextSort: CardexSortState,
  ) {
    setFilters(nextFilters);
    setSort(nextSort);

    router.setParams(toCardexRouteParams(nextFilters, nextSort));
  }

  function updateFilters(patch: Partial<CardexFilters>) {
    setRouteState(
      {
        ...filters,
        ...patch,
      },
      sort,
    );
  }

  function updateSort(patch: Partial<CardexSortState>) {
    setRouteState(filters, {
      ...sort,
      ...patch,
    });
  }

  function resetFilters() {
    setRouteState(
      {
        query: "",
        ownedOnly: false,
        setFilter: "ALL",
        colorFilter: "ALL",
        typeFilter: "ALL",
        rarityFilter: "ALL",
      },
      {
        sortKey: "set",
        sortDirection: "asc",
      },
    );
  }

  function openCard(card: RiftboundCard) {
    router.push({
      pathname: "/card/[id]",
      params: {
        id: card.id,
        context: "cardex",
        ...toCardexRouteParams(filters, sort),
      },
    });
  }

  return {
    cards,
    collection,
    filteredCards,
    filters,
    formatCardmarketPrice,
    isCollectionLoading,
    isPriceLoading,
    loadedPriceKeys,
    openCard,
    optionModels,
    ownershipByKey,
    pricesByKey,
    resetFilters,
    setVisibleCount,
    sort,
    updateFilters,
    updateSort,
    visibleCards,
    visibleCount,
  };
}
