import { Image, Text, View } from 'react-native';

import { styles } from '../screens/scan-screen.styles';

export function ScanCardPreview({ imageUri }: { imageUri: string }) {
  return (
    <View style={styles.cardImageWrap}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.cardImage} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>No image</Text>
        </View>
      )}
    </View>
  );
}

