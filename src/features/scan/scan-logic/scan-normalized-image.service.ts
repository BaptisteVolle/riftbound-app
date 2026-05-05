import { Buffer } from "buffer";
import { decode } from "jpeg-js";
import { SCAN_IMAGE_DEBUG } from "../debug/scan-debug-flag";
import { cropScanImage } from "./scan-image-crop.service";
import type { ScanCardImageRegion } from "./scan-image-signature.types";

export type NormalizedScanImage = {
  width: number;
  height: number;
  rgb: Uint8Array;
};

type NormalizeScanCardImageRegionOptions = {
  width: number;
  height: number;
  compress?: number;
};

function decodeJpegBase64(base64: string) {
  return decode(Buffer.from(base64, "base64"), {
    formatAsRGBA: true,
    tolerantDecoding: true,
    useTArray: true,
  });
}

async function getRotatedRegionUri(region: ScanCardImageRegion) {
  if (!region.rotationDegrees) {
    return region.uri;
  }

  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");

  const rotatedImage = await manipulateAsync(
    region.uri,
    [{ rotate: region.rotationDegrees }],
    {
      compress: 0.95,
      format: SaveFormat.JPEG,
    },
  );

  return rotatedImage.uri;
}

export async function normalizeScanCardImageRegion(
  region: ScanCardImageRegion,
  {
    width,
    height,
    compress = 0.85,
  }: NormalizeScanCardImageRegionOptions,
): Promise<NormalizedScanImage> {
  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");

  const rotatedUri = await getRotatedRegionUri(region);
  const croppedImage = await cropScanImage(rotatedUri, region.cropKind);

  const normalizedImage = await manipulateAsync(
    croppedImage.uri,
    [{ resize: { width, height } }],
    {
      base64: true,
      compress,
      format: SaveFormat.JPEG,
    },
  );

  if (!normalizedImage.base64) {
    throw new Error("Scan image could not be normalized.");
  }

  const decodedImage = decodeJpegBase64(normalizedImage.base64);
  const pixelCount = width * height;
  const rgb = new Uint8Array(pixelCount * 3);

  for (let index = 0; index < pixelCount; index += 1) {
    const sourceIndex = index * 4;
    const targetIndex = index * 3;

    rgb[targetIndex] = decodedImage.data[sourceIndex];
    rgb[targetIndex + 1] = decodedImage.data[sourceIndex + 1];
    rgb[targetIndex + 2] = decodedImage.data[sourceIndex + 2];
  }

  if (SCAN_IMAGE_DEBUG) {
    console.log("[IMAGE] normalized region:", {
      source: region.uri,
      cropKind: region.cropKind,
      layout: region.layout,
      imageSource: region.source,
      rotationDegrees: region.rotationDegrees ?? 0,
      width,
      height,
    });
  }

  return {
    width,
    height,
    rgb,
  };
}
