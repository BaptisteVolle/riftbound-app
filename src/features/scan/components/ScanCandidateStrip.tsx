import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import type { RiftboundCard } from '../../cards/cards.types';
import { styles } from '../screens/scan-screen.styles';

export function ScanCandidateStrip({
  candidates,
  hasDetectedCard,
  onApplyCandidate,
}: {
  candidates: RiftboundCard[];
  hasDetectedCard: boolean;
  onApplyCandidate: (card: RiftboundCard) => void;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <View style={styles.candidateStrip}>
      <View style={styles.candidateStripHeader}>
        <Text style={styles.candidateStripTitle}>
          {hasDetectedCard ? 'Other variants' : 'Possible matches'}
        </Text>
        <Text style={styles.candidateStripHint}>Tap to switch</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.candidateStripList}
      >
        {candidates.map((candidate) => {
          return (
            <Pressable
              key={candidate.id}
              onPress={() => {
                onApplyCandidate(candidate);
              }}
              style={styles.candidateTile}
            >
              {candidate.imageUrl ? (
                <Image
                  source={{ uri: candidate.imageUrl }}
                  style={styles.candidateTileImage}
                />
              ) : (
                <View style={styles.candidateTileImagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>No image</Text>
                </View>
              )}
              <Text numberOfLines={1} style={styles.candidateTileName}>
                {candidate.name}
              </Text>
              <Text style={styles.candidateTileMeta}>
                {candidate.setCode} {candidate.number}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

