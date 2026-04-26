import { StyleSheet, Text, View } from 'react-native';

export function ScannerOverlay() {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.frame}>
        <Text style={styles.label}>PLACE CARD HERE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: 28,
  },
  frame: {
    aspectRatio: 0.72,
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFD84D',
    borderRadius: 24,
    backgroundColor: 'rgba(17, 17, 17, 0.25)',
  },
  label: {
    color: '#FFD84D',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: '#111',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
});
