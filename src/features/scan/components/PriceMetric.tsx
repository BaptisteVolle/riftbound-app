import { Text, View } from 'react-native';

import { formatCardmarketPrice } from '../../cardmarket/cardmarket-prices.service';
import { styles } from '../screens/scan-screen.styles';

export function PriceMetric({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) {
  return (
    <View style={styles.priceMetric}>
      <Text style={styles.priceMetricLabel}>{label}</Text>
      <Text style={styles.priceMetricValue}>
        {formatCardmarketPrice(value)}
      </Text>
    </View>
  );
}

