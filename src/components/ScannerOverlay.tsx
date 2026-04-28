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
    justifyContent: 'flex-start',
    paddingHorizontal: 28,
    paddingTop: 72,
  },
  frame: {
    aspectRatio: 0.72,
    justifyContent: 'flex-start',
    borderWidth: 3,
    borderColor: '#F2B84B',
    borderRadius: 18,
    paddingTop: 86,
    backgroundColor: 'rgba(7, 21, 39, 0.28)',
  },
  label: {
    color: '#F8F0DC',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: '#071527',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
