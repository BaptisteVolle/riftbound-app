import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RIFTBOUND TOOLKIT</Text>

      <Pressable onPress={() => router.push('/scan')} style={[styles.button, styles.yellow]}>
        <Text style={styles.buttonText}>SCAN CARD</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/cardex')} style={[styles.button, styles.yellow]}>
        <Text style={styles.buttonText}>CARDEX</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/collection')} style={[styles.button, styles.blue]}>
        <Text style={styles.buttonText}>COLLECTION</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#7EE7FF',
  },
  title: {
    marginBottom: 18,
    color: '#111',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  button: {
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 18,
    paddingVertical: 18,
    shadowColor: '#111',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  yellow: {
    backgroundColor: '#FFD84D',
  },
  pink: {
    backgroundColor: '#FF6B9E',
  },
  blue: {
    backgroundColor: '#1F6F9F',
  },
  buttonText: {
    color: '#111',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
});
