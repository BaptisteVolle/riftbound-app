import { StyleSheet, Text, View } from 'react-native';

import { formatCardmarketPrice } from '../features/cardmarket/cardmarket-prices.service';
import { theme } from '../theme';

type PriceTagProps = {
  value?: number | null;
  label?: string;
};

export function PriceTag({ value, label = 'Trend' }: PriceTagProps) {
  return (
    <View style={styles.tag}>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value}>
        {formatCardmarketPrice(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    minWidth: 62,
    alignItems: 'flex-end',
    gap: 1,
  },
  label: {
    color: theme.colors.textFaint,
    fontSize: theme.fontSizes.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  value: {
    color: theme.colors.gold,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
});
