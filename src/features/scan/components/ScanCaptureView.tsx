import { Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { styles } from '../screens/scan-screen.styles';
import type { ScanStatus } from '../scan.types';

export function ScanCaptureView({
  isBusy,
  isCameraReady,
  message,
  onCapturePhoto,
  status,
}: {
  isBusy: boolean;
  isCameraReady: boolean;
  message: string;
  onCapturePhoto: () => void;
  status: ScanStatus;
}) {
  const label =
    status === 'capturing'
      ? 'CAPTURING...'
      : status === 'scanning'
        ? 'CHECKING...'
        : !isCameraReady
          ? 'CAMERA WARMING UP...'
          : 'CAPTURE PHOTO';

  return (
    <View style={styles.captureBar}>
      <Text style={styles.captureTitle}>SCAN RIFTBOUND CARD</Text>
      <Text style={styles.captureHint}>
        Frame the whole card, keep glare low, then capture.
      </Text>
      <Button
        disabled={isBusy || !isCameraReady}
        label={label}
        tone="orange"
        onPress={onCapturePhoto}
      />
      {message ? <Text style={styles.captureError}>{message}</Text> : null}
    </View>
  );
}

