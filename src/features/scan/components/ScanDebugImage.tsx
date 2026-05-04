import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { ScanDebugImage } from "../scan-debug.service";
import { shareScanDebugImage } from "../scan-debug.service";
import React from "react";

type Props = {
  images: ScanDebugImage[];
};

export function ScanDebugImages({ images }: Props) {
  if (!__DEV__ || images.length === 0) {
    return null;
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          color: "white",
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Scan debug crops
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.map((image) => (
          <View
            key={`${image.label}-${image.uri}`}
            style={{
              width: 170,
              marginRight: 12,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: "white",
                fontWeight: "600",
                marginBottom: 6,
              }}
            >
              {image.label}
            </Text>

            <Image
              source={{ uri: image.uri }}
              style={{
                width: 160,
                height: 220,
                resizeMode: "contain",
                backgroundColor: "#222",
                borderRadius: 8,
              }}
            />

            <Pressable
              onPress={() => shareScanDebugImage(image)}
              style={{
                marginTop: 8,
                paddingVertical: 8,
                paddingHorizontal: 10,
                backgroundColor: "#facc15",
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: "#111",
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                Share
              </Text>
            </Pressable>

            <Text
              numberOfLines={1}
              style={{
                color: "#aaa",
                fontSize: 10,
                marginTop: 4,
              }}
            >
              {image.width && image.height
                ? `${image.width}x${image.height}`
                : "original"}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
