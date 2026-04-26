import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'yellow' | 'pink' | 'blue' | 'dark';
  style?: ViewStyle;
};

export function Button({ label, onPress, disabled, tone = 'yellow', style }: ButtonProps) {
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
      <Text style={[styles.label, tone === 'dark' && styles.lightLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#111',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#111',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  label: {
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  lightLabel: {
    color: '#fff',
  },
  yellow: {
    backgroundColor: '#FFD84D',
  },
  pink: {
    backgroundColor: '#FF6B9E',
  },
  blue: {
    backgroundColor: '#7EE7FF',
  },
  dark: {
    backgroundColor: '#111',
  },
  disabled: {
    backgroundColor: '#ddd',
    opacity: 0.65,
  },
  pressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    shadowOffset: { width: 3, height: 3 },
  },
});
