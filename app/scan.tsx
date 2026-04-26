import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { ScannerOverlay } from '../src/components/ScannerOverlay';
import { simulateScan } from '../src/features/scan/scan.service';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  function handleSimulateScan() {
    const card = simulateScan();

    if (card) {
      router.push(`/card/${card.id}`);
    }
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Camera access is needed to scan cards.</Text>
        <Button label="ALLOW CAMERA" onPress={requestPermission} />
        <Button label="SIMULATE SCAN" tone="pink" onPress={handleSimulateScan} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />
      <ScannerOverlay />
      <View style={styles.actions}>
        <Button label="SIMULATE SCAN" tone="pink" onPress={handleSimulateScan} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  camera: {
    flex: 1,
  },
  actions: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    left: 24,
  },
  centered: {
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#7EE7FF',
  },
  message: {
    color: '#111',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
});
