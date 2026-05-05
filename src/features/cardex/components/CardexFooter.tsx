import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "../../../components/Button";
import { theme } from "../../../theme";

export function CardexFooter({
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
          <ActivityIndicator color={theme.colors.cream} size="small" />
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
  footer: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  footerText: {
    color: theme.colors.cream,
    fontSize: 13,
    fontWeight: "900",
  },
  loadMoreButton: {
    minWidth: 150,
    borderColor: theme.colors.black,
  },
  loadMoreButtonLabel: {
    fontSize: 13,
  },
});
