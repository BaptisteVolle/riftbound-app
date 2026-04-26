import { StyleSheet, Text, View } from 'react-native';

export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SEARCH CARDS</Text>
      <Text style={styles.body}>Manual search comes next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFD84D',
  },
  title: {
    color: '#111',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
