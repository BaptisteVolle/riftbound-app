import { Image, Text, View } from "react-native";

import type { RiftboundCard } from "../../cards/cards.types";
import { isBattlefieldCard } from "../../cards/cards.service";
import { styles } from "../screens/scan-screen.styles";

export function ScanCardPreview({
  card,
  imageUri,
}: {
  card?: RiftboundCard;
  imageUri: string;
}) {
  const shouldRotate = isBattlefieldCard(card);

  return (
    <View style={styles.cardImageWrap}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.cardImage,
            shouldRotate && styles.cardImageBattlefield,
          ]}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>No image</Text>
        </View>
      )}
    </View>
  );
}
