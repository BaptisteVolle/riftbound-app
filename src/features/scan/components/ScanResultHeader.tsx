import { Text, View } from "react-native";

import { styles } from "../screens/scan-screen.styles";
import type { ScanConfidence } from "../scan.types";
import { ScanConfidenceBadge } from "./ScanConfidenceBadge";
import React from "react";

export function ScanResultHeader({
  confidence,
  title,
  subtitle,
}: {
  confidence: ScanConfidence;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.resultHeaderRow}>
      <View style={styles.resultTitleBlock}>
        <Text
          numberOfLines={2}
          style={[styles.resultTitle, styles.resultTitleInHeader]}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text numberOfLines={1} style={styles.resultSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <ScanConfidenceBadge confidence={confidence} />
    </View>
  );
}
