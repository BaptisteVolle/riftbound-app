import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CardSymbolIcon } from '../../../components/CardSymbolIcon';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { formatCardmarketPrice } from '../../cardmarket/cardmarket-prices.service';
import { theme } from '../../../theme';
import { CollectionEntry, CollectionPrinting, CollectionRow } from '../collection.types';

type InventoryRowProps = {
  row: CollectionRow;
  onOpenCard: () => void;
  onOpenPrice: () => void;
  onChangeQuantity: (
    entry: CollectionEntry,
    printing: CollectionPrinting,
    delta: number,
  ) => void;
};

function getCardColors(entry: CollectionEntry) {
  const colors = entry.card.colors?.length ? entry.card.colors : [entry.card.color];
  return [...new Set(colors.filter(Boolean))].slice(0, 2);
}

export function InventoryRow({
  row,
  onOpenCard,
  onOpenPrice,
  onChangeQuantity,
}: InventoryRowProps) {
  const { entry } = row;
  const isOwned = row.totalQuantity > 0;
  const colors = getCardColors(entry);

  return (
    <View style={[styles.inventoryRow, !isOwned && styles.inventoryRowMuted]}>
      <Pressable onPress={onOpenCard} style={styles.thumbnailButton}>
        {entry.card.imageUrl ? (
          <Image
            resizeMode="contain"
            source={{ uri: entry.card.imageUrl }}
            style={styles.thumbnail}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailEmpty]} />
        )}
      </Pressable>

      <View style={styles.content}>
        <View style={styles.topLine}>
          <Pressable onPress={onOpenCard} style={styles.nameWrap}>
            <View style={styles.symbolRow}>
              <CardSymbolIcon kind="rarity" size={17} value={entry.card.rarity} />
              {colors.map((color) => (
                <CardSymbolIcon kind="color" key={color} size={17} value={color} />
              ))}
            </View>
            <Text numberOfLines={1} style={styles.name}>
              {entry.card.name}
            </Text>
          </Pressable>
          <Pressable onPress={onOpenPrice} style={styles.priceButton}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.priceButtonText}>
              {formatCardmarketPrice(row.trend)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.bottomLine}>
          <View style={styles.stepperRow}>
            <QuantityStepper
              minimal
              label="N"
              value={entry.normalQuantity}
              onIncrement={() => onChangeQuantity(entry, 'normal', 1)}
              onDecrement={() => onChangeQuantity(entry, 'normal', -1)}
            />
            <View style={styles.stepperDivider} />
            <QuantityStepper
              minimal
              label="F"
              value={entry.foilQuantity}
              onIncrement={() => onChangeQuantity(entry, 'foil', 1)}
              onDecrement={() => onChangeQuantity(entry, 'foil', -1)}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inventoryRow: {
    height: 86,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
    borderRadius: theme.radii.md,
    padding: 5,
    backgroundColor: theme.colors.panel,
  },
  inventoryRowMuted: {
    opacity: 0.52,
  },
  thumbnailButton: {
    width: 54,
    height: '100%',
    justifyContent: 'center',
  },
  thumbnail: {
    width: 54,
    height: 76,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: 5,
    backgroundColor: theme.colors.panelMuted,
  },
  thumbnailEmpty: {
    backgroundColor: theme.colors.panelRaised,
  },
  content: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  topLine: {
    minHeight: 32,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  symbolRow: {
    flexDirection: 'row',
    gap: 3,
  },
  priceButton: {
    minWidth: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: theme.colors.panelDeep,
  },
  priceButtonText: {
    color: theme.colors.gold,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  bottomLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  stepperRow: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  stepperDivider: {
    width: 1,
    height: 18,
    backgroundColor: theme.colors.panelBorder,
  },
});
