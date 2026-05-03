import { Text, View } from 'react-native';

import { getDisplayPrice } from '../../cardmarket/cardmarket-prices.service';
import type { CardmarketPriceSummary } from '../../cardmarket/cardmarket.types';
import type { CollectionPrinting } from '../../collection/collection.types';
import { styles } from '../screens/scan-screen.styles';
import { PriceMetric } from './PriceMetric';

export function ScanPriceBlock({
  cardmarketPrice,
  isPriceLoading,
  priceMessage,
  pricePrinting,
}: {
  cardmarketPrice?: CardmarketPriceSummary;
  isPriceLoading: boolean;
  priceMessage: string;
  pricePrinting: CollectionPrinting;
}) {
  return (
    <View style={styles.priceBlock}>
      {isPriceLoading ? (
        <Text style={styles.priceStatusText}>Loading prices...</Text>
      ) : priceMessage ? (
        <Text style={styles.priceStatusText}>{priceMessage}</Text>
      ) : (
        <View style={styles.priceMetricRow}>
          <PriceMetric
            label="Low"
            value={getDisplayPrice(cardmarketPrice, 'low', pricePrinting)}
          />
          <PriceMetric
            label="Avg"
            value={getDisplayPrice(cardmarketPrice, 'avg', pricePrinting)}
          />
          <PriceMetric
            label="Trend"
            value={getDisplayPrice(cardmarketPrice, 'trend', pricePrinting)}
          />
        </View>
      )}
    </View>
  );
}

