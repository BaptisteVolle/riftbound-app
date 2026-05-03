import { Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { styles } from '../screens/scan-screen.styles';
import type { ScanAnalysisFailed } from '../scan.types';

export function ScanFailedView({
  canRetryOcr,
  onEditManually,
  onRetakePhoto,
  onRetryOcr,
  result,
}: {
  canRetryOcr: boolean;
  onEditManually: () => void;
  onRetakePhoto: () => void;
  onRetryOcr: () => void;
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
          onPress={onRetakePhoto}
        />
        <Button
          disabled={!canRetryOcr}
          label="RETRY OCR"
          tone="blue"
          style={styles.failedActionButton}
          onPress={onRetryOcr}
        />
      </View>
      <Button label="EDIT MANUALLY" tone="gold" onPress={onEditManually} />
    </View>
  );
}

