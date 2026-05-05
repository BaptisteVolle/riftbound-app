import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { CardIdentityRow } from "../../../components/CardIdentityRow";
import { formatCardmarketPrice } from "../../cardmarket/cardmarket-prices.service";
import type { CardmarketPriceSummary } from "../../cardmarket/cardmarket.types";
import { isBattlefieldCard } from "../../cards/cards.service";
import type { RiftboundCard } from "../../cards/cards.types";
import { theme } from "../../../theme";
import { getCardexDisplayPrice } from "../cardex-price.service";
import type { CardexOwnershipSummary } from "../cardex.types";

export function CardexCardTile({
  card,
  isPriceReady,
  ownership,
  price,
  onPress,
}: {
  card: RiftboundCard;
  isPriceReady: boolean;
  ownership: CardexOwnershipSummary;
  price?: CardmarketPriceSummary;
  onPress: () => void;
}) {
  const displayPrice = getCardexDisplayPrice(price);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        ownership.total === 0 && styles.unownedCard,
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

          <View style={styles.priceTag}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.priceTagValue}
            >
              {isPriceReady ? formatCardmarketPrice(displayPrice) : "..."}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.imageFrame, styles.imagePlaceholder]}>
          <View style={styles.priceTag}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.priceTagValue}
            >
              {isPriceReady ? formatCardmarketPrice(displayPrice) : "..."}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.cardInfoBlock}>
        <CardIdentityRow
          card={card}
          compact
          showImage={false}
          textTone="dark"
        />

        <Text
          numberOfLines={1}
          style={[
            styles.ownedState,
            ownership.total === 0 && styles.missingState,
          ]}
        >
          {ownership.total > 0 ? "OWNED" : "NOT OWNED"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    maxWidth: "50%",
    gap: 9,
    borderWidth: 4,
    borderColor: theme.colors.black,
    borderRadius: 14,
    padding: 9,
    backgroundColor: theme.colors.white,
    shadowColor: theme.colors.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  unownedCard: {
    opacity: 0.82,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }, { translateY: 2 }],
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  imageFrame: {
    width: "100%",
    aspectRatio: 0.716,
    borderWidth: 3,
    borderColor: theme.colors.black,
    borderRadius: 10,
    backgroundColor: "#ddd",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  battlefieldImage: {
    transform: [{ rotate: "180deg" }],
  },
  imagePlaceholder: {
    backgroundColor: "#ddd",
  },
  priceTag: {
    position: "absolute",
    right: 6,
    bottom: 6,
    minWidth: 66,
    borderWidth: 2,
    borderColor: theme.colors.black,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: theme.colors.yellow,
  },

  priceTagValue: {
    color: theme.colors.black,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  cardInfoBlock: {
    minHeight: 46,
    gap: 3,
  },
  ownedState: {
    borderWidth: 2,
    borderColor: theme.colors.black,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 5,
    backgroundColor: theme.colors.sky,
    color: theme.colors.black,
    fontSize: 8,
    fontWeight: "900",
  },
  missingState: {
    backgroundColor: theme.colors.danger,
  },
});
