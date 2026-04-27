import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { ScannerOverlay } from '../src/components/ScannerOverlay';
import { RiftboundCard } from '../src/features/cards/cards.types';
import { buildCardmarketSearchUrl, buildCardmarketUrl } from '../src/features/cards/cards.service';
import { findRiftCodexCardFromScan } from '../src/features/riftcodex/riftcodex.service';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [name, setName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const [detectedCard, setDetectedCard] = useState<RiftboundCard | undefined>();
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'not-found'>('idle');
  const canSearchCardmarket = Boolean(name.trim() && setCode.trim() && number.trim());

  async function handleScan() {
    setScanStatus('scanning');
    setDetectedCard(undefined);
    setError('');

    try {
      const card = await findRiftCodexCardFromScan({ name, setCode, number });

      if (!card) {
        setScanStatus('not-found');
        setError('No card detected. Try name + set + number, like Sneaky Deckhand / OGN / 176/298.');
        return;
      }

      setName(card.name);
      setSetCode(card.setCode);
      setNumber(card.number);
      setDetectedCard(card);
      setScanStatus('found');
    } catch {
      setScanStatus('not-found');
      setError('RiftCodex lookup failed. Check your connection and try again.');
    }
  }

  function handleSearchCardmarket() {
    if (!canSearchCardmarket) {
      setError('Scan a card first so name, set, and number are filled.');
      return;
    }

    const url = detectedCard
      ? buildCardmarketUrl(detectedCard)
      : buildCardmarketSearchUrl({ name, setCode, number });

    if (!url) {
      setError('Enter at least a card name, set, or number.');
      return;
    }

    setError('');
    Linking.openURL(url);
  }

  const scanControls = (
    <View style={styles.controls}>
      <Button
        disabled={scanStatus === 'scanning'}
        label={scanStatus === 'scanning' ? 'SCANNING...' : 'SCAN'}
        tone="orange"
        onPress={handleScan}
      />
      {scanStatus === 'found' && detectedCard ? (
        <View style={styles.foundBox}>
          <Text style={styles.foundTitle}>CARD FOUND</Text>
          <Text style={styles.foundText}>
            {detectedCard.name} - {detectedCard.setCode} {detectedCard.number}
          </Text>
        </View>
      ) : null}
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
          maxLength={8}
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
  foundBox: {
    borderWidth: 2,
    borderColor: '#F2B84B',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#123F6D',
  },
  foundTitle: {
    color: '#F2B84B',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  foundText: {
    marginTop: 2,
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
