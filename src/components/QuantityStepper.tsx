import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Button } from './Button';
import { theme } from '../theme';

type QuantityStepperProps = {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  compact?: boolean;
  minimal?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function QuantityStepper({
  label,
  value,
  onIncrement,
  onDecrement,
  compact = false,
  minimal = false,
  style,
}: QuantityStepperProps) {
  return (
    <View
      style={[
        styles.stepper,
        compact && styles.stepperCompact,
        minimal && styles.stepperMinimal,
        style,
      ]}
    >
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      <Button
        disabled={value === 0}
        label="-"
        tone="dark"
        style={[
          styles.button,
          compact && styles.buttonCompact,
          minimal && styles.buttonMinimal,
        ]}
        labelStyle={[styles.buttonLabel, compact && styles.buttonLabelCompact]}
        onPress={onDecrement}
      />
      <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
      <Button
        label="+"
        tone="dark"
        style={[
          styles.button,
          compact && styles.buttonCompact,
          minimal && styles.buttonMinimal,
        ]}
        labelStyle={[styles.buttonLabel, compact && styles.buttonLabelCompact]}
        onPress={onIncrement}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.md,
    padding: 5,
    backgroundColor: theme.colors.panelRaised,
  },
  stepperCompact: {
    gap: 4,
    padding: 3,
  },
  stepperMinimal: {
    borderWidth: 0,
    padding: 0,
    backgroundColor: 'transparent',
  },
  label: {
    minWidth: 14,
    color: theme.colors.textSoft,
    fontSize: 11,
    fontWeight: '900',
  },
  labelCompact: {
    minWidth: 10,
    fontSize: 10,
  },
  value: {
    minWidth: 22,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  valueCompact: {
    minWidth: 16,
    fontSize: 13,
  },
  button: {
    minWidth: 32,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: 7,
    paddingVertical: 4,
    paddingHorizontal: 5,
    shadowOpacity: 0,
  },
  buttonCompact: {
    minWidth: 24,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  buttonMinimal: {
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
    backgroundColor: theme.colors.panelDeep,
  },
  buttonLabel: {
    fontSize: 13,
  },
  buttonLabelCompact: {
    fontSize: 11,
  },
});
