import { Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'gold' | 'orange' | 'blue' | 'dark' | 'yellow' | 'pink';
  style?: ViewStyle;
  labelStyle?: TextStyle;
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
    borderColor: '#F8F0DC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#071527',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 0,
  },
  label: {
    color: '#071527',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  lightLabel: {
    color: '#fff',
  },
  gold: {
    backgroundColor: '#F2B84B',
  },
  orange: {
    backgroundColor: '#E66A2C',
  },
  yellow: {
    backgroundColor: '#F2B84B',
  },
  pink: {
    backgroundColor: '#E66A2C',
  },
  blue: {
    backgroundColor: '#1F6F9F',
  },
  dark: {
    backgroundColor: '#071527',
  },
  disabled: {
    backgroundColor: '#6F7D8C',
    opacity: 0.75,
  },
  pressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 2 },
  },
});
