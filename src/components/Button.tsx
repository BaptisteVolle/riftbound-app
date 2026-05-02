import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

import { theme } from '../theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'gold' | 'orange' | 'blue' | 'dark' | 'yellow' | 'pink';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function Button({
  label,
  onPress,
  disabled,
  tone = 'gold',
  style,
  labelStyle,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, tone === 'dark' && styles.lightLabel, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.cream,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.soft,
  },
  label: {
    color: theme.colors.appBackground,
    fontSize: theme.fontSizes.button,
    fontWeight: '900',
    textAlign: 'center',
  },
  lightLabel: {
    color: theme.colors.white,
  },
  gold: {
    backgroundColor: theme.colors.goldSoft,
  },
  orange: {
    backgroundColor: theme.colors.orange,
  },
  yellow: {
    backgroundColor: theme.colors.goldSoft,
  },
  pink: {
    backgroundColor: theme.colors.orange,
  },
  blue: {
    backgroundColor: theme.colors.blue,
  },
  dark: {
    backgroundColor: theme.colors.appBackground,
  },
  disabled: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.75,
  },
  pressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 2 },
  },
});
