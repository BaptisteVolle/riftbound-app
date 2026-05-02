import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { theme } from '../theme';

type AppPanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppPanel({ children, style }: AppPanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.panel,
  },
});
