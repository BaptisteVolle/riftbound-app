import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { CardSymbolIcon } from '../../../components/CardSymbolIcon';
import { PriceTag } from '../../../components/PriceTag';
import { QuantityStepper } from '../../../components/QuantityStepper';
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

export function InventoryRow({
  row,
  onOpenCard,
  onOpenPrice,
  onChangeQuantity,
}: InventoryRowProps) {
  const { entry } = row;

  return (
    <View style={styles.inventoryRow}>
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
        <Pressable onPress={onOpenCard} style={styles.topLine}>
          <View style={styles.nameWrap}>
            <Text numberOfLines={1} style={styles.name}>
              {entry.card.name}
            </Text>
            <View style={styles.symbolRow}>
              <CardSymbolIcon kind="rarity" size={17} value={entry.card.rarity} />
              <CardSymbolIcon kind="color" size={17} value={entry.card.color} />
            </View>
          </View>
          <PriceTag value={row.trend} />
        </Pressable>

        <View style={styles.bottomLine}>
          <View style={styles.stepperRow}>
            <QuantityStepper
              compact
              minimal
              label="N"
              value={entry.normalQuantity}
              onIncrement={() => onChangeQuantity(entry, 'normal', 1)}
              onDecrement={() => onChangeQuantity(entry, 'normal', -1)}
            />
            <View style={styles.stepperDivider} />
            <QuantityStepper
              compact
              minimal
              label="F"
              value={entry.foilQuantity}
              onIncrement={() => onChangeQuantity(entry, 'foil', 1)}
              onDecrement={() => onChangeQuantity(entry, 'foil', -1)}
            />
          </View>
          <Button
            label="CM"
            tone="dark"
            style={styles.cardmarketButton}
            labelStyle={styles.cardmarketButtonLabel}
            onPress={onOpenPrice}
          />
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
    minHeight: 34,
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  symbolRow: {
    flexDirection: 'row',
    gap: 5,
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
    gap: 5,
  },
  stepperDivider: {
    width: 1,
    height: 18,
    backgroundColor: theme.colors.panelBorder,
  },
  cardmarketButton: {
    minWidth: 38,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: 7,
    paddingVertical: 4,
    paddingHorizontal: 6,
    shadowOpacity: 0,
  },
  cardmarketButtonLabel: {
    fontSize: 10,
  },
});
