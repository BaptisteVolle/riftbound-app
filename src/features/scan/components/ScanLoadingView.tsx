import { ActivityIndicator, Text, View } from 'react-native';

import { styles } from '../screens/scan-screen.styles';
import type { ScanAnalysisStep } from '../scan.types';

export function ScanLoadingView({
  message,
}: {
  step?: ScanAnalysisStep;
  message: string;
}) {
  return (
    <View style={styles.checkingPanel}>
      <ActivityIndicator color="#F2B84B" size="small" />
      <Text style={styles.checkingText}>{message || 'Checking card...'}</Text>
    </View>
  );
}

