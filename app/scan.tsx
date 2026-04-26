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

  function handleUseSample() {
    setName('Hextech Ray');
    setSetCode('OGN');
    setNumber('009');
    setError('');
  }

  function handleSearchCardmarket() {
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
      <Button label="SEARCH CARDMARKET" tone="yellow" onPress={handleSearchCardmarket} />
      <Button label="USE HEXTECH SAMPLE" tone="pink" onPress={handleUseSample} />
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
      <View style={styles.actions}>
        {scanControls}
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
  controls: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 17,
    fontWeight: '800',
  },
  compactInput: {
    flex: 1,
  },
  error: {
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FF6B9E',
    color: '#111',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
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
