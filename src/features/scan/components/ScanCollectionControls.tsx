import { Text, View } from "react-native";

import { Button } from "../../../components/Button";
import { styles } from "../screens/scan-screen.styles";
import React from "react";

export function ScanCollectionControls({
  actionDisabled,
  actionLabel,
  collectionMessage,
  isSavingCollection,
  onPrimaryAction,
  onUpdateQuantity,
  quantity,
}: {
  actionDisabled: boolean;
  actionLabel: string;
  collectionMessage: string;
  isSavingCollection: boolean;
  onPrimaryAction: () => void;
  onUpdateQuantity: (delta: number) => void;
  quantity: number;
}) {
  return (
    <>
      <View style={styles.controlRow}>
        <View style={styles.controlColumn}>
          <Text style={styles.controlLabel}>Copies</Text>

          <View style={styles.stepperRow}>
            <Button
              disabled={quantity <= 1 || isSavingCollection}
              label="-"
              tone="dark"
              style={styles.stepperButton}
              onPress={() => onUpdateQuantity(-1)}
            />

            <Text style={styles.quantityValue}>{quantity}</Text>

            <Button
              disabled={isSavingCollection}
              label="+"
              tone="dark"
              style={styles.stepperButton}
              onPress={() => onUpdateQuantity(1)}
            />
          </View>
        </View>

        <View style={styles.controlColumn}>
          <Button
            disabled={actionDisabled}
            label={actionLabel}
            tone="orange"
            labelStyle={styles.collectionAddButtonLabel}
            style={[styles.collectionAddButton, styles.fullWidthControl]}
            onPress={onPrimaryAction}
          />
        </View>
      </View>
      {collectionMessage ? (
        <Text style={styles.collectionMessage}>{collectionMessage}</Text>
      ) : null}
    </>
  );
}
