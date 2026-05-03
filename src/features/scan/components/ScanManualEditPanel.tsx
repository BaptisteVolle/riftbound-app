import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '../../../components/Button';
import { styles } from '../screens/scan-screen.styles';
import type { ScanStatus } from '../scan.types';

export function ScanManualEditPanel({
  capturedPhotoUri,
  isBusy,
  isOpen,
  name,
  number,
  onCheckFields,
  onNameChange,
  onNumberChange,
  onRetryOcr,
  onSetCodeChange,
  onToggle,
  scanStatus,
  setCode,
}: {
  capturedPhotoUri: string;
  isBusy: boolean;
  isOpen: boolean;
  name: string;
  number: string;
  onCheckFields: () => void;
  onNameChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  onRetryOcr: () => void;
  onSetCodeChange: (value: string) => void;
  onToggle: () => void;
  scanStatus: ScanStatus;
  setCode: string;
}) {
  return (
    <View style={styles.editDropdownPanel}>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={styles.editToggle}
      >
        <Text style={styles.editToggleText}>Not right? Edit and check again</Text>
        <Text style={styles.editToggleIcon}>{isOpen ? '-' : '+'}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.inlineEditPanel}>
          <TextInput
            autoCapitalize="words"
            blurOnSubmit
            onChangeText={onNameChange}
            placeholder="Card name"
            placeholderTextColor="#667085"
            returnKeyType="done"
            style={styles.input}
            value={name}
          />
          <View style={styles.row}>
            <TextInput
              autoCapitalize="characters"
              blurOnSubmit
              maxLength={6}
              onChangeText={onSetCodeChange}
              placeholder="Set"
              placeholderTextColor="#667085"
              returnKeyType="done"
              style={[styles.input, styles.compactInput]}
              value={setCode}
            />
            <TextInput
              blurOnSubmit
              maxLength={8}
              onChangeText={onNumberChange}
              placeholder="No."
              placeholderTextColor="#667085"
              returnKeyType="done"
              style={[styles.input, styles.compactInput]}
              value={number}
            />
          </View>
          <View style={styles.row}>
            <Button
              disabled={isBusy}
              label={scanStatus === 'scanning' ? 'CHECKING...' : 'CHECK FIELDS'}
              tone="gold"
              style={styles.actionButton}
              onPress={onCheckFields}
            />
            <Button
              disabled={isBusy || !capturedPhotoUri}
              label="RETRY SCAN"
              tone="blue"
              style={styles.actionButton}
              onPress={onRetryOcr}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

