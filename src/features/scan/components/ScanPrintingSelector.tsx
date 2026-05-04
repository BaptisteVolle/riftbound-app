import { Pressable, Text, View } from 'react-native';

import type { CollectionPrinting } from '../../collection/collection.types';
import { styles } from '../screens/scan-screen.styles';

export function ScanPrintingSelector({
  activePrinting,
  disabled,
  label,
  onChangePrinting,
}: {
  activePrinting: CollectionPrinting;
  disabled: boolean;
  label: string;
  onChangePrinting: (printing: CollectionPrinting) => void;
}) {
  return (
    <View style={styles.printingControl}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.segmentedControl}>
        <Pressable
          disabled={disabled}
          onPress={() => onChangePrinting('normal')}
          style={[
            styles.segmentButton,
            activePrinting === 'normal' && styles.segmentButtonActive,
            disabled && styles.segmentButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activePrinting === 'normal' && styles.segmentTextActive,
            ]}
          >
            Normal
          </Text>
        </Pressable>
        <Pressable
          disabled={disabled}
          onPress={() => onChangePrinting('foil')}
          style={[
            styles.segmentButton,
            activePrinting === 'foil' && styles.segmentButtonActive,
            disabled && styles.segmentButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              activePrinting === 'foil' && styles.segmentTextActive,
            ]}
          >
            Foil
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

