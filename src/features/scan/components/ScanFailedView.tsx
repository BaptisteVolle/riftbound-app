import { Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { styles } from '../screens/scan-screen.styles';
import type { ScanAnalysisFailed } from '../scan.types';

export function ScanFailedView({
  actions,
  canRetryOcr,
  result,
}: {
  actions: {
    onEditManually: () => void;
    onRetakePhoto: () => void;
    onRetryOcr: () => void;
  };
  canRetryOcr: boolean;
  result: ScanAnalysisFailed;
}) {
  return (
    <View style={styles.failedPanel}>
      <Text style={styles.failedTitle}>Scan needs help</Text>
      <Text style={styles.failedMessage}>{result.reason}</Text>
      <View style={styles.failedActionRow}>
        <Button
          label="RETAKE PHOTO"
          tone="orange"
          style={styles.failedActionButton}
          onPress={actions.onRetakePhoto}
        />
        <Button
          disabled={!canRetryOcr}
          label="RETRY OCR"
          tone="blue"
          style={styles.failedActionButton}
          onPress={actions.onRetryOcr}
        />
      </View>
      <Button
        label="EDIT MANUALLY"
        tone="gold"
        onPress={actions.onEditManually}
      />
    </View>
  );
}
