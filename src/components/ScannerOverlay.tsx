import type { LayoutRectangle } from "react-native";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import React from "react";

type ScannerOverlayProps = {
  onFrameLayout?: (layout: LayoutRectangle) => void;
};

export function ScannerOverlay({ onFrameLayout }: ScannerOverlayProps) {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View
        style={styles.frame}
        onLayout={(event) => {
          onFrameLayout?.(event.nativeEvent.layout);
        }}
      >
        <Text style={styles.label}>PLACE CARD HERE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 48,
  },
  frame: {
    width: "92%",
    aspectRatio: 63 / 88,
    justifyContent: "flex-start",
    borderWidth: 3,
    borderColor: theme.colors.goldSoft,
    borderRadius: 20,
    paddingTop: 94,
    backgroundColor: "rgba(7, 21, 39, 0.28)",
  },
  label: {
    color: theme.colors.cream,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: theme.colors.appBackground,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
