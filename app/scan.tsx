import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '../src/components/Button';
import { ScannerOverlay } from '../src/components/ScannerOverlay';
import { RiftboundCard } from '../src/features/cards/cards.types';
import {
  buildCardmarketSearchUrl,
  buildCardmarketUrlForCard,
} from '../src/features/cards/cards.service';
import { findRiftCodexCardFromScan } from '../src/features/riftcodex/riftcodex.service';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [name, setName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const [detectedCard, setDetectedCard] = useState<RiftboundCard | undefined>();
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'not-found'>('idle');
  const [lastUrl, setLastUrl] = useState('');
  const [lastUrlMode, setLastUrlMode] = useState('');
  const canSearchCardmarket = Boolean(name.trim());

  async function handleScan() {
    if (!name.trim() && !setCode.trim() && !number.trim()) {
      setScanStatus('not-found');
      setDetectedCard(undefined);
      setLastUrl('');
      setLastUrlMode('');
      setError('Camera OCR is not enabled yet. Enter text first, then validate with RiftCodex.');
      return;
    }

    setScanStatus('scanning');
    setDetectedCard(undefined);
    setLastUrl('');
    setLastUrlMode('');
    setError('');

    try {
      const card = await findRiftCodexCardFromScan({ name, setCode, number });

      if (!card) {
        setScanStatus('not-found');
        setError('No RiftCodex match. You can still search Cardmarket by card name.');
        return;
      }

      setName(card.name);
      setSetCode(card.setCode);
      setNumber(card.number);
      setDetectedCard(card);
      setScanStatus('found');
      const cardmarketUrl = buildCardmarketUrlForCard(card);
      setLastUrl(cardmarketUrl);
      setLastUrlMode(`RiftCodex found - ${card.rarity ?? 'variant'} URL`);
    } catch {
      setScanStatus('not-found');
      setError('RiftCodex lookup failed. Check your connection and try again.');
    }
  }

  function handleSearchCardmarket() {
    if (!canSearchCardmarket) {
      setError('Enter a card name before searching Cardmarket.');
      return;
    }

    const url = detectedCard
      ? buildCardmarketUrlForCard(detectedCard)
      : buildCardmarketSearchUrl({ name, setCode, number });

    if (!url) {
      setError('Enter at least a card name, set, or number.');
      return;
    }

    setError('');
    setLastUrl(url);
    setLastUrlMode(
      detectedCard
        ? `RiftCodex found - ${detectedCard.rarity ?? 'variant'} URL`
        : 'RiftCodex not found - name search',
    );
    Linking.openURL(url);
  }

  async function handleCopyUrl() {
    const url =
      lastUrl ||
      (detectedCard
        ? buildCardmarketUrlForCard(detectedCard)
        : buildCardmarketSearchUrl({ name, setCode, number }));

    if (!url) {
      setError('No Cardmarket URL to copy yet.');
      return;
    }

    await Clipboard.setStringAsync(url);
    setLastUrl(url);
    setLastUrlMode(
      detectedCard
        ? `RiftCodex found - ${detectedCard.rarity ?? 'variant'} URL`
        : 'RiftCodex not found - name search',
    );
    setError('URL copied.');
  }

  const scanControls = (
    <View style={styles.controls}>
      <Button
        disabled={scanStatus === 'scanning'}
        label={scanStatus === 'scanning' ? 'CHECKING...' : 'CHECK RIFTCODEX'}
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
      {lastUrlMode ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>{lastUrlMode}</Text>
          <Text numberOfLines={2} style={styles.debugText}>
            {lastUrl}
          </Text>
        </View>
      ) : null}
      <TextInput
        autoCapitalize="words"
        blurOnSubmit
        onChangeText={setName}
        placeholder="Card name"
        placeholderTextColor="#555"
        returnKeyType="done"
        style={styles.input}
        value={name}
      />
      <View style={styles.row}>
        <TextInput
          autoCapitalize="characters"
          blurOnSubmit
          maxLength={6}
          onChangeText={setSetCode}
          placeholder="Set"
          placeholderTextColor="#555"
          returnKeyType="done"
          style={[styles.input, styles.compactInput]}
          value={setCode}
        />
        <TextInput
          blurOnSubmit
          maxLength={8}
          onChangeText={setNumber}
          placeholder="No."
          placeholderTextColor="#555"
          returnKeyType="done"
          style={[styles.input, styles.compactInput]}
          value={number}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Button
          disabled={!canSearchCardmarket}
          label="SEARCH"
          tone="gold"
          style={styles.actionButton}
          onPress={handleSearchCardmarket}
        />
        <Button
          disabled={!canSearchCardmarket && !lastUrl}
          label="COPY URL"
          tone="blue"
          style={styles.actionButton}
          onPress={handleCopyUrl}
        />
      </View>
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <CameraView style={styles.camera} facing="back" />
      <ScannerOverlay />
      <View style={styles.bottomPanel}>
        {scanControls}
      </View>
    </KeyboardAvoidingView>
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
  actionButton: {
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
  debugBox: {
    borderWidth: 2,
    borderColor: '#F8F0DC',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#092A4C',
  },
  debugTitle: {
    color: '#F2B84B',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  debugText: {
    marginTop: 4,
    color: '#F8F0DC',
    fontSize: 12,
    fontWeight: '700',
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
