import React from "react";
import { FlatList, Text, TextInput, View, StyleSheet } from "react-native";

import { Button } from "../src/components/Button";
import { getCollectionCardKey } from "../src/features/collection/collection.service";
import { CardexCardTile } from "../src/features/cardex/components/CardexCardTile";
import { CardexFiltersPanel } from "../src/features/cardex/components/CardexFiltersPanel";
import { CardexFooter } from "../src/features/cardex/components/CardexFooter";
import { useCardexScreenState } from "../src/features/cardex/hooks/useCardexScreenState";
import { theme } from "../src/theme";

export default function CardexScreen() {
  const {
    filteredCards,
    filters,
    isCollectionLoading,
    isPriceLoading,
    loadedPriceKeys,
    openCard,
    optionModels,
    ownershipByKey,
    pricesByKey,
    resetFilters,
    sort,
    updateFilters,
    updateSort,
    visibleCards,
    visibleCount,
    setVisibleCount,
  } = useCardexScreenState();

  return (
    <FlatList
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>CARDEX</Text>

          <Text style={styles.subtitle}>
            {visibleCards.length} / {filteredCards.length} cards
          </Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(query) => updateFilters({ query })}
            placeholder="Filter cards..."
            placeholderTextColor={theme.colors.placeholder}
            style={styles.input}
            value={filters.query}
          />

          <View style={styles.filterRow}>
            <Button
              label={filters.ownedOnly ? "OWNED ONLY" : "ALL CARDS"}
              tone={filters.ownedOnly ? "orange" : "gold"}
              style={styles.filterButton}
              onPress={() => updateFilters({ ownedOnly: !filters.ownedOnly })}
            />

            <Button
              label="RESET"
              tone="dark"
              style={styles.filterButton}
              onPress={resetFilters}
            />
          </View>

          <CardexFiltersPanel
            filters={filters}
            optionModels={optionModels}
            sort={sort}
            updateFilters={updateFilters}
            updateSort={updateSort}
          />

          {isCollectionLoading ? (
            <Text style={styles.loadingText}>Loading Cardex...</Text>
          ) : null}
        </View>
      }
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.container}
      data={visibleCards}
      initialNumToRender={24}
      keyExtractor={(card) => card.id}
      ListFooterComponent={
        <CardexFooter
          hasMore={visibleCount < filteredCards.length}
          isLoadingPrices={isPriceLoading}
          onLoadMore={() => {
            setVisibleCount((currentCount) =>
              Math.min(filteredCards.length, currentCount + 24),
            );
          }}
        />
      }
      numColumns={2}
      onEndReached={() => {
        if (visibleCount < filteredCards.length) {
          setVisibleCount((currentCount) =>
            Math.min(filteredCards.length, currentCount + 24),
          );
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

        return (
          <CardexCardTile
            card={card}
            isPriceReady={Boolean(loadedPriceKeys[cardKey])}
            ownership={ownership}
            price={pricesByKey[cardKey]}
            onPress={() => openCard(card)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 14,
    paddingTop: 58,
    paddingBottom: 42,
    backgroundColor: theme.colors.appBackground,
  },
  header: {
    gap: 14,
  },
  title: {
    color: theme.colors.cream,
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.cream,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  input: {
    borderWidth: 4,
    borderColor: theme.colors.black,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.white,
    color: theme.colors.black,
    fontSize: 17,
    fontWeight: "900",
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterButton: {
    flex: 1,
    borderColor: theme.colors.black,
    paddingHorizontal: 8,
  },
  loadingText: {
    color: theme.colors.cream,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  gridRow: {
    gap: 12,
  },
});
