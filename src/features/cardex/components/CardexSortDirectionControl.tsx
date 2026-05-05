import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../../../theme";
import type { CardexSortDirection } from "../cardex.types";

export function CardexSortDirectionControl({
  value,
  onChange,
}: {
  value: CardexSortDirection;
  onChange: (value: CardexSortDirection) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Direction</Text>

      <View style={styles.segmented}>
        {[
          { label: "ASC", value: "asc" },
          { label: "DESC", value: "desc" },
        ].map((option) => {
          const optionValue = option.value as CardexSortDirection;
          const isActive = value === optionValue;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(optionValue)}
              style={[styles.button, isActive && styles.buttonActive]}
            >
              <Text style={[styles.text, isActive && styles.textActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  segmented: {
    minHeight: 42,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.panelDeep,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  buttonActive: {
    backgroundColor: theme.colors.gold,
  },
  text: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  textActive: {
    color: theme.colors.ink,
  },
});
