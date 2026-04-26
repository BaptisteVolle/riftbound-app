import { StyleSheet, Text, View } from 'react-native';

export default function ScanScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.frame}>
        <Text style={styles.label}>PLACE CARD HERE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#111',
  },
  frame: {
    aspectRatio: 0.72,
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFD84D',
    borderRadius: 24,
    backgroundColor: '#222',
  },
  label: {
    color: '#FFD84D',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
});
