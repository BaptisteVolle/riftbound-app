import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardPreview } from '../src/components/CardPreview';
import { getAllCards } from '../src/features/cards/cards.service';
import { RiftboundCard } from '../src/features/cards/cards.types';
import { fetchRiftCodexCards } from '../src/features/riftcodex/riftcodex.service';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<RiftboundCard[]>(getAllCards());
  const [sourceLabel, setSourceLabel] = useState('Local fallback');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    fetchRiftCodexCards()
      .then((riftCodexCards) => {
        if (!isMounted) {
          return;
        }

        setCards(riftCodexCards);
        setSourceLabel(`RiftCodex - ${riftCodexCards.length} cards`);
        setError('');
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setCards(getAllCards());
        setSourceLabel('Local fallback');
        setError('RiftCodex unavailable, showing local cards.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      return cards.slice(0, 40);
    }

    return cards
      .filter((card) =>
        `${card.name} ${card.set} ${card.setCode} ${card.number} ${card.color} ${card.type}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 40);
  }, [cards, query]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>SEARCH CARDS</Text>
      <Text style={styles.source}>{sourceLabel}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setQuery}
        placeholder="Jinx, OGN, 143..."
        placeholderTextColor="#555"
        style={styles.input}
        value={query}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  source: {
    color: '#111',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
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
  results: {
    gap: 16,
  },
});
