import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppPanel } from "../src/components/AppPanel";
import { Button } from "../src/components/Button";
import { DropdownSelect } from "../src/components/DropdownSelect";
import {
  CardmarketPriceCacheStatus,
  forceRefreshCardmarketPriceData,
  formatPriceCacheAge,
  formatRefreshWaitTime,
  getCardmarketPriceCacheStatus,
  getCardmarketPriceForCard,
} from "../src/features/cardmarket/cardmarket-prices.service";
import { CardmarketPriceSummary } from "../src/features/cardmarket/cardmarket.types";
import {
  buildCardmarketSearchUrl,
  getCardexCards,
  getOpenableCardmarketUrlForCard,
} from "../src/features/cards/cards.service";
import {
  addCardToCollection,
  getCollection,
  getCollectionCardKey,
  removeCardFromCollection,
  toCollectionCardSnapshot,
} from "../src/features/collection/collection.service";
import { getCollectionCompletionStats } from "../src/features/collection/collection-stats.service";
import { CollectionCompletionPanel } from "../src/features/collection/components/CollectionCompletionPanel";
import { InventoryRow } from "../src/features/collection/components/CollectionRows";
import {
  CollectionEntry,
  CollectionPrinting,
} from "../src/features/collection/collection.types";
import {
  COLLECTION_SORT_OPTIONS,
  CollectionPrintingFilter,
  CollectionSortDirection,
  CollectionSortKey,
  buildCollectionRow,
  sortCollectionRows,
} from "../src/features/collection/collection-view-model";
import { theme } from "../src/theme";

type OwnershipFilter = "owned" | "all" | "not-owned";

function getOptionValues(values: string[]) {
  return [
    "ALL",
    ...new Set(values.filter(Boolean).sort((a, b) => a.localeCompare(b))),
  ];
}

function toDropdownOptions<TValue extends string>(values: readonly TValue[]) {
  return values.map((value) => ({
    label: value === "ALL" ? "All" : value,
    value,
  }));
}

export default function CollectionScreen() {
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [pricesByKey, setPricesByKey] = useState<
    Record<string, CardmarketPriceSummary | undefined>
  >({});
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState("ALL");
  const [colorFilter, setColorFilter] = useState("ALL");
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("owned");
  const [printingFilter, setPrintingFilter] =
    useState<CollectionPrintingFilter>("all");
  const [sortKey, setSortKey] = useState<CollectionSortKey>("set");
  const [sortDirection, setSortDirection] =
    useState<CollectionSortDirection>("asc");
  const [toastMessage, setToastMessage] = useState("");
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
            showToast("Collection could not be loaded.");
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  const catalogCards = useMemo(() => getCardexCards(), []);
  const collectionByKey = useMemo(
    () => new Map(collection.map((entry) => [entry.cardKey, entry])),
    [collection],
  );
  const catalogEntries = useMemo(
    () =>
      catalogCards.map((card) => {
        const cardKey = getCollectionCardKey(card);
        const ownedEntry = collectionByKey.get(cardKey);

        if (ownedEntry) {
          return ownedEntry;
        }

        return {
          cardKey,
          card: toCollectionCardSnapshot(card),
          normalQuantity: 0,
          foilQuantity: 0,
          language: "EN",
          condition: "NM",
          createdAt: "",
          updatedAt: "",
        } satisfies CollectionEntry;
      }),
    [catalogCards, collectionByKey],
  );

  const displayEntries = useMemo(() => {
    if (ownershipFilter === "owned") {
      return collection;
    }

    return catalogEntries;
  }, [catalogEntries, collection, ownershipFilter]);

  const COLLECTION_PAGE_SIZE = 60;

  const [visibleCount, setVisibleCount] = useState(COLLECTION_PAGE_SIZE);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = setTimeout(() => setToastMessage(""), 1000);

    return () => clearTimeout(timeout);
  }, [toastMessage]);

  const completionStats = useMemo(
    () => getCollectionCompletionStats(collection),
    [collection],
  );
  const setOptions = useMemo(
    () => getOptionValues(catalogEntries.map((entry) => entry.card.setCode)),
    [catalogEntries],
  );
  const colorOptions = useMemo(
    () =>
      getOptionValues(
        catalogEntries.flatMap((entry) =>
          entry.card.colors?.length ? entry.card.colors : [entry.card.color],
        ),
      ),
    [catalogEntries],
  );
  const rarityOptions = useMemo(
    () =>
      getOptionValues(
        catalogEntries.map((entry) => entry.card.rarity ?? entry.card.type),
      ),
    [catalogEntries],
  );
  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const builtRows = displayEntries.map((entry) =>
      buildCollectionRow(entry, pricesByKey[entry.cardKey]),
    );

    const filteredRows = builtRows.filter((row) => {
      const { entry } = row;
      const rarity = entry.card.rarity ?? entry.card.type;
      const isOwned = row.totalQuantity > 0;
      const colorHaystack = entry.card.colors?.join(" ") ?? entry.card.color;
      const haystack =
        `${entry.card.name} ${entry.card.set} ${entry.card.setCode} ${entry.card.number} ${colorHaystack} ${rarity}`.toLowerCase();

      if (normalizedQuery && !haystack.includes(normalizedQuery)) {
        return false;
      }

      if (setFilter !== "ALL" && entry.card.setCode !== setFilter) {
        return false;
      }

      if (
        colorFilter !== "ALL" &&
        !(entry.card.colors ?? [entry.card.color]).includes(colorFilter)
      ) {
        return false;
      }

      if (rarityFilter !== "ALL" && rarity !== rarityFilter) {
        return false;
      }

      if (ownershipFilter === "owned" && !isOwned) {
        return false;
      }

      if (ownershipFilter === "not-owned" && isOwned) {
        return false;
      }

      if (printingFilter === "normal" && entry.normalQuantity <= 0) {
        return false;
      }

      if (printingFilter === "foil" && entry.foilQuantity <= 0) {
        return false;
      }

      return true;
    });

    return sortCollectionRows(filteredRows, sortKey, sortDirection);
  }, [
    colorFilter,
    displayEntries,
    ownershipFilter,
    pricesByKey,
    printingFilter,
    query,
    rarityFilter,
    setFilter,
    sortDirection,
    sortKey,
  ]);

  const visibleRows = useMemo(() => {
    return rows.slice(0, visibleCount);
  }, [rows, visibleCount]);

  const visiblePriceKey = useMemo(
    () => visibleRows.map((row) => row.entry.cardKey).join("|"),
    [visibleRows],
  );

  useEffect(() => {
    setVisibleCount(COLLECTION_PAGE_SIZE);
  }, [
    colorFilter,
    ownershipFilter,
    printingFilter,
    query,
    rarityFilter,
    setFilter,
    sortDirection,
    sortKey,
  ]);

  useEffect(() => {
    let isActive = true;

    const missingPriceEntries = visibleRows
      .map((row) => row.entry)
      .filter((entry) => !pricesByKey[entry.cardKey]);

    if (missingPriceEntries.length === 0) {
      return () => {
        isActive = false;
      };
    }

    Promise.all(
      missingPriceEntries.map(async (entry) => {
        const price = await getCardmarketPriceForCard(entry.card).catch(
          () => undefined,
        );

        return [entry.cardKey, price] as const;
      }),
    ).then((nextPrices) => {
      if (!isActive) {
        return;
      }

      setPricesByKey((currentPrices) => ({
        ...currentPrices,
        ...Object.fromEntries(nextPrices),
      }));
    });

    return () => {
      isActive = false;
    };
  }, [visiblePriceKey, pricesByKey]);

  const filteredCardIds = useMemo(
    () => rows.map((row) => row.entry.card.id),
    [rows],
  );

  const setFilterOptions = useMemo(
    () => toDropdownOptions(setOptions),
    [setOptions],
  );
  const colorFilterOptions = useMemo(
    () => toDropdownOptions(colorOptions),
    [colorOptions],
  );
  const rarityFilterOptions = useMemo(
    () => toDropdownOptions(rarityOptions),
    [rarityOptions],
  );
  const printingFilterOptions = useMemo(
    () =>
      [
        { label: "All", value: "all" },
        { label: "Normal", value: "normal" },
        { label: "Foil", value: "foil" },
      ] satisfies Array<{ label: string; value: CollectionPrintingFilter }>,
    [],
  );
  const sortOptions = useMemo(
    () =>
      COLLECTION_SORT_OPTIONS.map((value) => ({
        label:
          value === "set"
            ? "Set / Number"
            : value === "price"
              ? "Price"
              : value.toUpperCase(),
        value,
      })),
    [],
  );
  const sortDirectionOptions = useMemo(
    () =>
      [
        { label: "Ascending", value: "asc" },
        { label: "Descending", value: "desc" },
      ] satisfies Array<{ label: string; value: CollectionSortDirection }>,
    [],
  );

  function showToast(text: string) {
    setToastMessage(text);
  }

  function applyLocalQuantityChange(
    currentCollection: CollectionEntry[],
    targetEntry: CollectionEntry,
    printing: CollectionPrinting,
    delta: number,
  ) {
    const nextCollection = [...currentCollection];
    const entryIndex = nextCollection.findIndex(
      (entry) => entry.cardKey === targetEntry.cardKey,
    );
    const existingEntry =
      entryIndex >= 0 ? nextCollection[entryIndex] : targetEntry;
    const currentQuantity =
      printing === "foil"
        ? existingEntry.foilQuantity
        : existingEntry.normalQuantity;

    if (delta < 0 && currentQuantity <= 0) {
      return currentCollection;
    }

    const nextEntry = {
      ...existingEntry,
      normalQuantity:
        printing === "normal"
          ? Math.max(0, existingEntry.normalQuantity + delta)
          : existingEntry.normalQuantity,
      foilQuantity:
        printing === "foil"
          ? Math.max(0, existingEntry.foilQuantity + delta)
          : existingEntry.foilQuantity,
      updatedAt: new Date().toISOString(),
    };

    if (entryIndex >= 0) {
      nextCollection[entryIndex] = nextEntry;
    } else {
      nextCollection.push(nextEntry);
    }

    return nextCollection.filter(
      (entry) => entry.normalQuantity + entry.foilQuantity > 0,
    );
  }

  async function changeQuantity(
    entry: CollectionEntry,
    printing: CollectionPrinting,
    delta: number,
  ) {
    const currentQuantity =
      printing === "foil" ? entry.foilQuantity : entry.normalQuantity;

    if (delta < 0 && currentQuantity <= 0) {
      return;
    }

    setCollection((currentCollection) =>
      applyLocalQuantityChange(currentCollection, entry, printing, delta),
    );
    showToast(
      delta > 0
        ? "1 card added to collection"
        : "1 card removed from collection",
    );

    try {
      if (delta > 0) {
        await addCardToCollection(entry.card, printing);
      } else {
        await removeCardFromCollection(entry.cardKey, printing);
      }
    } catch {
      showToast("Collection update failed.");
      await loadCollection();
    }
  }

  async function openPrice(entry: CollectionEntry) {
    showToast("Checking Cardmarket page...");

    const resolvedUrl = await getOpenableCardmarketUrlForCard(entry.card, {
      printing:
        entry.foilQuantity > 0 && entry.normalQuantity === 0
          ? "foil"
          : "normal",
    });
    const url =
      resolvedUrl.url ??
      buildCardmarketSearchUrl({
        name: entry.card.name,
      });

    if (!url) {
      showToast("No Cardmarket URL found for this card.");
      return;
    }

    if (resolvedUrl.mode === "search") {
      showToast("Opening Cardmarket search.");
    }

    Linking.openURL(url);
  }

  function openCard(entry: CollectionEntry) {
    router.push({
      pathname: "/card/[id]",
      params: {
        id: entry.card.id,
        ids: filteredCardIds.join(","),
      },
    });
  }

  async function refreshPrices() {
    setIsRefreshingPrices(true);

    try {
      const result = await forceRefreshCardmarketPriceData();
      const nextStatus = await getCardmarketPriceCacheStatus();
      setPriceCacheStatus(nextStatus);

      if (result.didRefresh) {
        setPricesByKey({});
        showToast("Cardmarket prices refreshed.");
      } else {
        showToast(
          `Prices refreshed recently. Wait ${formatRefreshWaitTime(
            result.status.forceRefreshAvailableInMs,
          )}.`,
        );
      }
    } catch {
      showToast("Could not refresh prices.");
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>COLLECTION</Text>

        <CollectionCompletionPanel
          collapsedByDefault
          stats={completionStats}
          sections={["sets", "rarities", "colors"]}
        />

        <AppPanel style={styles.priceSyncPanel}>
          <View style={styles.priceSyncCopy}>
            <Text style={styles.priceSyncTitle}>Cardmarket</Text>
            <Text style={styles.priceSyncText}>
              Updated {formatPriceCacheAge(priceCacheStatus?.ageMs)}
            </Text>
          </View>
          <Button
            disabled={priceRefreshDisabled}
            label={
              isRefreshingPrices
                ? "UPDATING..."
                : priceCacheStatus?.canForceRefresh === false
                  ? `WAIT ${formatRefreshWaitTime(priceCacheStatus.forceRefreshAvailableInMs)}`
                  : "REFRESH"
            }
            tone="blue"
            style={styles.priceSyncButton}
            onPress={refreshPrices}
          />
        </AppPanel>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={
            ownershipFilter === "owned"
              ? "Filter owned cards..."
              : ownershipFilter === "not-owned"
                ? "Filter missing cards..."
                : "Filter all cards..."
          }
          placeholderTextColor={theme.colors.placeholder}
          style={styles.input}
          value={query}
        />

        <AppPanel style={styles.filterPanel}>
          <View style={styles.ownershipSwitch}>
            {[
              { label: "OWNED", value: "owned" },
              { label: "ALL", value: "all" },
              { label: "NOT OWNED", value: "not-owned" },
            ].map((option) => {
              const isActive = ownershipFilter === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    setOwnershipFilter(option.value as OwnershipFilter)
                  }
                  style={[
                    styles.ownershipButton,
                    isActive && styles.ownershipButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.ownershipButtonText,
                      isActive && styles.ownershipButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.filterGrid}>
            <DropdownSelect
              label="Set"
              options={setFilterOptions}
              value={setFilter}
              onChange={setSetFilter}
            />
            <DropdownSelect
              label="Element"
              options={colorFilterOptions}
              value={colorFilter}
              onChange={setColorFilter}
            />
            <DropdownSelect
              label="Rarity"
              options={rarityFilterOptions}
              value={rarityFilter}
              onChange={setRarityFilter}
            />
            <DropdownSelect
              label="Printing"
              options={printingFilterOptions}
              value={printingFilter}
              onChange={setPrintingFilter}
            />
            <DropdownSelect
              label="Sort"
              options={sortOptions}
              value={sortKey}
              onChange={setSortKey}
            />
            <DropdownSelect
              label="Direction"
              options={sortDirectionOptions}
              value={sortDirection}
              onChange={setSortDirection}
            />
          </View>
        </AppPanel>

        {isLoading ? (
          <Text style={styles.empty}>Loading collection...</Text>
        ) : null}
        {!isLoading &&
        collection.length === 0 &&
        ownershipFilter === "owned" ? (
          <Text style={styles.empty}>No cards yet. Use Scan to start.</Text>
        ) : null}
        {!isLoading &&
        rows.length === 0 &&
        !(collection.length === 0 && ownershipFilter === "owned") ? (
          <Text style={styles.empty}>
            {ownershipFilter === "not-owned"
              ? "No missing cards match these filters."
              : ownershipFilter === "all"
                ? "No cards match these filters."
                : "No owned cards match these filters."}
          </Text>
        ) : null}

        <View style={styles.results}>
          {visibleRows.map((row) => (
            <InventoryRow
              key={row.entry.cardKey}
              row={row}
              onOpenCard={() => openCard(row.entry)}
              onOpenPrice={() => openPrice(row.entry)}
              onChangeQuantity={changeQuantity}
            />
          ))}

          {visibleCount < rows.length ? (
            <Button
              label={`LOAD MORE (${rows.length - visibleCount})`}
              tone="blue"
              onPress={() => {
                setVisibleCount((currentCount) =>
                  Math.min(rows.length, currentCount + COLLECTION_PAGE_SIZE),
                );
              }}
            />
          ) : null}
        </View>
      </ScrollView>
      {toastMessage ? (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.appBackgroundAlt,
  },
  container: {
    gap: 14,
    padding: 14,
    paddingTop: 58,
    paddingBottom: 42,
    backgroundColor: theme.colors.appBackgroundAlt,
  },
  title: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  priceSyncPanel: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  priceSyncCopy: {
    flex: 1,
    gap: 2,
  },
  priceSyncTitle: {
    color: theme.colors.textSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  priceSyncText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  priceSyncButton: {
    minWidth: 104,
    paddingHorizontal: 8,
  },
  input: {
    borderWidth: 3,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.panelDeep,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPanel: {
    gap: 10,
  },
  ownershipSwitch: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.panelDeep,
  },
  ownershipButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  ownershipButtonActive: {
    backgroundColor: theme.colors.gold,
  },
  ownershipButtonText: {
    color: theme.colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  ownershipButtonTextActive: {
    color: theme.colors.appBackground,
  },
  empty: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  results: {
    gap: 10,
  },
  toast: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
    borderRadius: theme.radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.panelRaised,
  },
  toastText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
});
