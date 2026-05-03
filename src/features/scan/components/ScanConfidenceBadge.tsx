import { Text, View } from 'react-native';

import { styles } from '../screens/scan-screen.styles';
import type { ScanConfidence } from '../scan.types';

export function ScanConfidenceBadge({
  confidence,
}: {
  confidence: ScanConfidence;
}) {
  const label =
    confidence === 'exact'
      ? 'Exact match'
      : confidence === 'likely'
        ? 'Likely match'
        : confidence === 'uncertain'
          ? 'Needs confirmation'
          : 'Scan failed';
  const badgeStyle =
    confidence === 'exact'
      ? styles.confidenceBadgeExact
      : confidence === 'likely'
        ? styles.confidenceBadgeLikely
        : confidence === 'uncertain'
          ? styles.confidenceBadgeUncertain
          : styles.searchBadge;

  return (
    <View style={[styles.confidenceBadge, badgeStyle]}>
      <Text style={styles.confidenceText}>{label}</Text>
    </View>
  );
}

