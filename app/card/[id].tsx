import { useLocalSearchParams } from 'expo-router';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import {
  buildCardmarketSearchUrl,
  buildCardmarketUrl,
  getCardById,
} from '../../src/features/cards/cards.service';
import { formatCardMeta } from '../../src/lib/utils';

export default function CardDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    set?: string;
    setCode?: string;
    number?: string;
    color?: string;
    cost?: string;
    type?: string;
    imageUrl?: string;
  }>();
  const localCard = params.id ? getCardById(params.id) : undefined;
  const card =
    localCard ??
    (params.name && params.setCode && params.number
      ? {
          id: params.id,
          name: params.name,
          set: params.set ?? params.setCode,
          setCode: params.setCode,
          number: params.number,
          color: params.color ?? 'Unknown',
          cost: Number(params.cost ?? 0),
          type: params.type ?? 'Card',
          imageUrl: params.imageUrl || undefined,
        }
      : undefined);

  if (!card) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>CARD NOT FOUND</Text>
      </View>
    );
  }

  const cardmarketUrl =
    localCard ? buildCardmarketUrl(localCard) : buildCardmarketSearchUrl(card) ?? '';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={styles.image} /> : null}
      <View style={styles.hero}>
        <Text style={styles.name}>{card.name}</Text>
        <Text style={styles.meta}>{formatCardMeta(card.setCode, card.number)}</Text>
      </View>

      <View style={styles.panel}>
        <Info label="Set" value={card.set} />
        <Info label="Type" value={card.type} />
        <Info label="Color" value={card.color} />
        <Info label="Cost" value={String(card.cost)} />
      </View>

      <Button
        label="OPEN CARDMARKET"
        onPress={() => {
          Linking.openURL(cardmarketUrl);
        }}
        tone="pink"
      />
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    padding: 24,
    paddingBottom: 42,
    backgroundColor: '#7EE7FF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#7EE7FF',
  },
  hero: {
    gap: 12,
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 22,
    padding: 22,
    backgroundColor: '#FFD84D',
    shadowColor: '#111',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  image: {
    width: '100%',
    aspectRatio: 0.716,
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  name: {
    color: '#111',
    fontSize: 36,
    fontWeight: '900',
  },
  meta: {
    color: '#111',
    fontSize: 20,
    fontWeight: '900',
  },
  title: {
    color: '#111',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  panel: {
    gap: 12,
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#111',
    paddingBottom: 10,
  },
  infoLabel: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
  infoValue: {
    flex: 1,
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
});
