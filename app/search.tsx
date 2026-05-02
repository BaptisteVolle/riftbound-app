import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { CardIdentityRow } from '../src/components/CardIdentityRow';
import { getAllCards } from '../src/features/cards/cards.service';
import { RiftboundCard } from '../src/features/cards/cards.types';
import { fetchRiftCodexCards } from '../src/features/riftcodex/riftcodex.service';
import { theme } from '../src/theme';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<RiftboundCard[]>(getAllCards());
  const [sourceLabel, setSourceLabel] = useState('Local starter cards');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      setCards(getAllCards());
      setSourceLabel('Type 2+ characters to search RiftCodex');
      setError('');
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);
    fetchRiftCodexCards(normalizedQuery, 40)
      .then((riftCodexCards) => {
        if (!isMounted) {
          return;
        }

        setCards(riftCodexCards);
        setSourceLabel(`RiftCodex - ${riftCodexCards.length} results`);
        setError('');
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setCards(getAllCards());
        setSourceLabel('Local fallback');
        setError('RiftCodex unavailable, showing local cards.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [query]);

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
  const resultIds = useMemo(() => results.map((card) => card.id), [results]);

  function openCard(card: RiftboundCard) {
    router.push({
      pathname: '/card/[id]',
      params: {
        id: card.id,
        ids: resultIds.join(','),
        name: card.name,
        set: card.set,
        setCode: card.setCode,
        number: card.number,
        color: card.color,
        cost: String(card.cost),
        type: card.type,
        rarity: card.rarity ?? '',
        alternateArt: card.alternateArt ? 'true' : '',
        overnumbered: card.overnumbered ? 'true' : '',
        signature: card.signature ? 'true' : '',
        matchConfidence: card.matchConfidence ?? '',
        imageUrl: card.imageUrl ?? '',
      },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>SEARCH CARDS</Text>
      <View style={styles.topActions}>
        <Button label="SCAN" tone="orange" style={styles.topButton} onPress={() => router.push('/scan')} />
        <Button label="CARDEX" tone="blue" style={styles.topButton} onPress={() => router.push('/cardex')} />
      </View>
      <Text style={styles.source}>{sourceLabel}</Text>
      {isLoading ? <Text style={styles.source}>Loading...</Text> : null}
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
          <View key={card.id} style={styles.resultRow}>
            <CardIdentityRow card={card} onPress={() => openCard(card)} />
          </View>
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
    backgroundColor: theme.colors.appBackgroundAlt,
  },
  title: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  input: {
    borderWidth: 4,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.panelDeep,
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topButton: {
    flex: 1,
    borderColor: theme.colors.controlBorder,
  },
  source: {
    color: theme.colors.textSoft,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  error: {
    borderWidth: 3,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.lg,
    padding: 10,
    backgroundColor: theme.colors.danger,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  results: {
    gap: 16,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
    borderRadius: theme.radii.md,
    padding: 8,
    backgroundColor: theme.colors.panel,
  },
});
