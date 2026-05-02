import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { RiftboundCard } from '../features/cards/cards.types';
import { formatCardMeta } from '../lib/utils';
import { theme } from '../theme';
import { CardSymbolIcon } from './CardSymbolIcon';

type CardIdentityRowProps = {
  card: Pick<
    RiftboundCard,
    'name' | 'setCode' | 'number' | 'color' | 'rarity' | 'imageUrl' | 'type'
  >;
  onPress?: () => void;
  showImage?: boolean;
  showMeta?: boolean;
  compact?: boolean;
  textTone?: 'light' | 'dark';
};

export function CardIdentityRow({
  card,
  onPress,
  showImage = true,
  showMeta = true,
  compact = false,
  textTone = 'light',
}: CardIdentityRowProps) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper onPress={onPress} style={[styles.row, compact && styles.rowCompact]}>
      {showImage ? (
        card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={[styles.thumbnail, compact && styles.thumbnailCompact]} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailEmpty, compact && styles.thumbnailCompact]} />
        )
      ) : null}
      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              textTone === 'dark' && styles.darkName,
              compact && styles.nameCompact,
            ]}
          >
            {card.name}
          </Text>
          <CardSymbolIcon kind="rarity" size={compact ? 18 : 22} value={card.rarity} />
          <CardSymbolIcon kind="color" size={compact ? 18 : 22} value={card.color} />
        </View>
        {showMeta ? (
          <Text
            numberOfLines={1}
            style={[styles.meta, textTone === 'dark' && styles.darkMeta]}
          >
            {formatCardMeta(card.setCode, card.number)} · {card.type}
          </Text>
        ) : null}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rowCompact: {
    gap: 7,
  },
  thumbnail: {
    width: 46,
    aspectRatio: 0.716,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: 5,
    backgroundColor: theme.colors.panelMuted,
  },
  thumbnailCompact: {
    width: 42,
  },
  thumbnailEmpty: {
    backgroundColor: theme.colors.panelRaised,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  darkName: {
    color: theme.colors.black,
  },
  nameCompact: {
    fontSize: 15,
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  darkMeta: {
    color: theme.colors.ink,
  },
});
