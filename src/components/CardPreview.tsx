import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCardMeta } from '../lib/utils';
import { RiftboundCard } from '../features/cards/cards.types';

type CardPreviewProps = {
  card: RiftboundCard;
  showImage?: boolean;
  contextIds?: string[];
};

export function CardPreview({ card, showImage = false, contextIds }: CardPreviewProps) {
  function handleOpenCard() {
    router.push({
      pathname: '/card/[id]',
      params: {
        id: card.id,
        ids: contextIds?.join(',') ?? '',
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
    <Pressable onPress={handleOpenCard} style={styles.card}>
      {showImage && card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={styles.image} /> : null}
      <Text style={styles.name}>{card.name}</Text>
      <Text style={styles.meta}>{formatCardMeta(card.setCode, card.number)}</Text>
      <View style={styles.row}>
        <Text style={styles.pill}>{card.set}</Text>
        <Text style={styles.pill}>{card.color}</Text>
        <Text style={styles.pill}>Cost {card.cost}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    width: '100%',
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#fff',
    shadowColor: '#111',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  image: {
    width: '100%',
    aspectRatio: 0.716,
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 12,
    backgroundColor: '#ddd',
  },
  name: {
    color: '#111',
    fontSize: 22,
    fontWeight: '900',
  },
  meta: {
    color: '#111',
    fontSize: 15,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 3,
    borderColor: '#111',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FFD84D',
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
});
