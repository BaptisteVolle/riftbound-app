import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPreview } from '../src/components/CardPreview';
import { searchCards } from '../src/features/cards/cards.service';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCards(query), [query]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>SEARCH CARDS</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setQuery}
        placeholder="Jinx, OGN, 143..."
        placeholderTextColor="#555"
        style={styles.input}
        value={query}
      />
      <View style={styles.results}>
        {results.map((card) => (
          <CardPreview card={card} key={card.id} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 24,
    paddingBottom: 42,
    backgroundColor: '#FFD84D',
  },
  title: {
    color: '#111',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  input: {
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    color: '#111',
    fontSize: 19,
    fontWeight: '900',
    shadowColor: '#111',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  results: {
    gap: 16,
  },
});
