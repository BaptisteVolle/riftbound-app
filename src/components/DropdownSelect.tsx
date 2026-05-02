import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { theme } from '../theme';

type DropdownOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type DropdownSelectProps<TValue extends string> = {
  label: string;
  options: DropdownOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
};

export function DropdownSelect<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: DropdownSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  function handleChange(nextValue: TValue) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={styles.control}
      >
        <Text numberOfLines={1} style={styles.value}>
          {selectedOption?.label ?? value}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.menu}>
            <Text style={styles.menuTitle}>{label}</Text>
            <ScrollView style={styles.menuScroll}>
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => handleChange(option.value)}
                    style={[styles.option, isSelected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    flexBasis: 148,
    gap: 5,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  control: {
    minHeight: 42,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.md,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.panelDeep,
  },
  value: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  chevron: {
    color: theme.colors.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(7, 17, 23, 0.68)',
  },
  menu: {
    maxHeight: '72%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.panel,
  },
  menuTitle: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.panelBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: theme.colors.gold,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  menuScroll: {
    maxHeight: 420,
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionSelected: {
    backgroundColor: theme.colors.gold,
  },
  optionText: {
    color: theme.colors.textSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  optionTextSelected: {
    color: theme.colors.ink,
    fontWeight: '900',
  },
});
