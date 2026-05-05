import * as Sharing from "expo-sharing";

import {
  cropScanImage,
  normalizePhotoForScan,
} from "../scan-logic/scan-image-crop.service";
import { SCAN_DEBUG } from "./scan-debug-flag";
export type ScanDebugImage = {
  label: string;
  uri: string;
  width?: number;
  height?: number;
};

export async function createScanDebugImages(photoUri: string) {
  const normalizedPhoto = await normalizePhotoForScan(photoUri);

  const images: ScanDebugImage[] = [
    {
      label: "Original photo",
      uri: photoUri,
    },
    {
      label: "Normalized photo",
      uri: normalizedPhoto.uri,
      width: normalizedPhoto.width,
      height: normalizedPhoto.height,
    },
  ];

  for (const kind of [
    "full-card",
    "artwork",
    "name-band",
    "collector-bottom",
  ] as const) {
    const crop = await cropScanImage(normalizedPhoto.uri, kind);

    images.push({
      label: kind,
      uri: crop.uri,
      width: crop.width,
      height: crop.height,
    });
  }

  if (SCAN_DEBUG) {
    console.log("[SCAN DEBUG] images:", images);
  }

  return images;
}

export async function shareScanDebugImage(image: ScanDebugImage) {
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    if (SCAN_DEBUG) {
      console.log("[SCAN DEBUG] sharing unavailable:", image);
    }

    return;
  }

  await Sharing.shareAsync(image.uri, {
    dialogTitle: `Share ${image.label}`,
  });
}
