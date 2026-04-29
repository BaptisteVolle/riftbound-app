import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  getCardmarketPriceCacheStatus,
  refreshCardmarketPriceData,
} from '../src/features/cardmarket/cardmarket-prices.service';

export default function RootLayout() {
  const [priceSyncMode, setPriceSyncMode] = useState<'idle' | 'background' | 'blocking'>('idle');
  const [priceSyncMessage, setPriceSyncMessage] = useState('');

  useEffect(() => {
    let isActive = true;
    let clearMessageTimer: ReturnType<typeof setTimeout> | undefined;

    async function syncPriceData() {
      const status = await getCardmarketPriceCacheStatus();

      if (status.isFresh) {
        return;
      }

      if (isActive) {
        setPriceSyncMode(status.hasCache ? 'background' : 'blocking');
        setPriceSyncMessage(
          status.hasCache ? 'Updating Cardmarket prices...' : 'Loading price guide...',
        );
      }

      try {
        await refreshCardmarketPriceData();

        if (isActive) {
          setPriceSyncMessage('Cardmarket prices updated');
        }
      } catch {
        if (isActive) {
          setPriceSyncMessage(
            status.hasCache ? 'Using cached Cardmarket prices' : 'Prices unavailable offline',
          );
        }
      } finally {
        if (isActive) {
          setPriceSyncMode('idle');
          clearMessageTimer = setTimeout(() => {
            if (isActive) {
              setPriceSyncMessage('');
            }
          }, 2200);
        }
      }
    }

    syncPriceData().catch(() => {
      if (isActive) {
        setPriceSyncMode('idle');
      }
    });

    return () => {
      isActive = false;

      if (clearMessageTimer) {
        clearTimeout(clearMessageTimer);
      }
    };
  }, []);

  return (
    <View style={styles.root}>
      <Slot />
      {priceSyncMode !== 'idle' || priceSyncMessage ? (
        <View
          pointerEvents={priceSyncMode === 'blocking' ? 'auto' : 'none'}
          style={[
            styles.priceSyncOverlay,
            priceSyncMode === 'blocking'
              ? styles.priceSyncOverlayBlocking
              : styles.priceSyncOverlayFloating,
          ]}
        >
          <View style={styles.priceSyncBox}>
            {priceSyncMode !== 'idle' ? (
              <ActivityIndicator color="#F2B84B" />
            ) : null}
            <Text style={styles.priceSyncText}>{priceSyncMessage}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  priceSyncOverlay: {
    position: 'absolute',
    right: 16,
    left: 16,
    alignItems: 'center',
  },
  priceSyncOverlayBlocking: {
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 21, 39, 0.76)',
  },
  priceSyncOverlayFloating: {
    bottom: 28,
  },
  priceSyncBox: {
    minWidth: 220,
    maxWidth: 320,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#F8F0DC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#092A4C',
  },
  priceSyncText: {
    flexShrink: 1,
    color: '#F8F0DC',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
});
