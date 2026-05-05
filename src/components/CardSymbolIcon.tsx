import { Image, StyleSheet, Text, View } from "react-native";

import {
  CardIconKind,
  getColorIcon,
  getRarityIcon,
} from "../features/cards/card-icons";

type CardSymbolIconProps = {
  kind: CardIconKind;
  value?: string;
  size?: number;
};

export function CardSymbolIcon({
  kind,
  value,
  size = 22,
}: CardSymbolIconProps) {
  const icon = kind === "rarity" ? getRarityIcon(value) : getColorIcon(value);
  const imageSize = Math.round(size * 0.82);

  return (
    <View
      accessibilityLabel={`${icon.label} ${kind}`}
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${icon.color}22`,
        },
      ]}
    >
      {icon.source ? (
        <Image
          resizeMode="contain"
          source={icon.source}
          style={{
            width: imageSize,
            height: imageSize,
          }}
        />
      ) : (
        <Text
          style={[
            styles.fallback,
            {
              color: icon.color,
              fontSize: size * 0.56,
              lineHeight: size,
            },
          ]}
        >
          {icon.fallback}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fallback: {
    includeFontPadding: false,
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center",
  },
});
