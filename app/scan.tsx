import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { ScannerOverlay } from '../src/components/ScannerOverlay';
import { buildCardmarketSearchUrl } from '../src/features/cards/cards.service';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [name, setName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const canSearchCardmarket = Boolean(name.trim() && setCode.trim() && number.trim());

  function handleScan() {
    setName('Hextech Ray');
    setSetCode('OGN');
    setNumber('009');
    setError('');
  }

  function handleSearchCardmarket() {
    if (!canSearchCardmarket) {
      setError('Scan a card first so name, set, and number are filled.');
      return;
    }

    const url = buildCardmarketSearchUrl({ name, setCode, number });

    if (!url) {
      setError('Enter at least a card name, set, or number.');
      return;
    }

    setError('');
    Linking.openURL(url);
  }

  const scanControls = (
    <View style={styles.controls}>
      <Button label="SCAN" tone="orange" onPress={handleScan} />
      <TextInput
        autoCapitalize="words"
        onChangeText={setName}
        placeholder="Card name"
        placeholderTextColor="#555"
        style={styles.input}
        value={name}
      />
      <View style={styles.row}>
        <TextInput
          autoCapitalize="characters"
          maxLength={6}
          onChangeText={setSetCode}
          placeholder="Set"
          placeholderTextColor="#555"
          style={[styles.input, styles.compactInput]}
          value={setCode}
        />
        <TextInput
          keyboardType="number-pad"
          maxLength={3}
          onChangeText={setNumber}
          placeholder="No."
          placeholderTextColor="#555"
          style={[styles.input, styles.compactInput]}
          value={number}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={!canSearchCardmarket}
        label="SEARCH CARDMARKET"
        tone="gold"
        onPress={handleSearchCardmarket}
      />
    </View>
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Loading camera...</Text>
        {scanControls}
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Camera access is needed to scan cards.</Text>
        <Button label="ALLOW CAMERA" onPress={requestPermission} />
        {scanControls}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />
      <ScannerOverlay />
      <View style={styles.bottomPanel}>
        {scanControls}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071527',
  },
  camera: {
    flex: 1,
  },
  bottomPanel: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    left: 18,
    borderWidth: 2,
    borderColor: '#F8F0DC',
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(9, 42, 76, 0.96)',
  },
  controls: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    borderWidth: 2,
    borderColor: '#F2B84B',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8F0DC',
    color: '#071527',
    fontSize: 16,
    fontWeight: '800',
  },
  compactInput: {
    flex: 1,
  },
  error: {
    borderWidth: 2,
    borderColor: '#F8F0DC',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#E66A2C',
    color: '#F8F0DC',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#071527',
  },
  message: {
    color: '#F8F0DC',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
});
