import { Directory, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { LayoutRectangle } from "react-native";

export type ScanDebugCropKind =
  | "full-card"
  | "artwork"
  | "name-band"
  | "collector-bottom";

export type ScanDebugImage = {
  label: string;
  uri: string;
  width?: number;
  height?: number;
};

type CropPhotoToScannerFrameInput = {
  photoUri: string;
  cameraLayout: LayoutRectangle;
  scannerFrameLayout: LayoutRectangle;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getImageCropFromPreviewFrame({
  imageWidth,
  imageHeight,
  cameraLayout,
  scannerFrameLayout,
}: {
  imageWidth: number;
  imageHeight: number;
  cameraLayout: LayoutRectangle;
  scannerFrameLayout: LayoutRectangle;
}) {
  /**
   * Camera preview behaves like resizeMode="cover".
   * The camera image is scaled to cover the visible CameraView.
   */
  const scale = Math.max(
    cameraLayout.width / imageWidth,
    cameraLayout.height / imageHeight,
  );

  const displayedImageWidth = imageWidth * scale;
  const displayedImageHeight = imageHeight * scale;

  const horizontalOverflow = displayedImageWidth - cameraLayout.width;
  const verticalOverflow = displayedImageHeight - cameraLayout.height;

  const offsetX = horizontalOverflow / 2;
  const offsetY = verticalOverflow / 2;

  const frameXInCamera = scannerFrameLayout.x - cameraLayout.x;
  const frameYInCamera = scannerFrameLayout.y - cameraLayout.y;

  const originX = Math.round((frameXInCamera + offsetX) / scale);
  const originY = Math.round((frameYInCamera + offsetY) / scale);
  const width = Math.round(scannerFrameLayout.width / scale);
  const height = Math.round(scannerFrameLayout.height / scale);

  const safeOriginX = clamp(originX, 0, imageWidth - 1);
  const safeOriginY = clamp(originY, 0, imageHeight - 1);
  const safeWidth = clamp(width, 1, imageWidth - safeOriginX);
  const safeHeight = clamp(height, 1, imageHeight - safeOriginY);

  return {
    originX: safeOriginX,
    originY: safeOriginY,
    width: safeWidth,
    height: safeHeight,
  };
}

export async function cropPhotoToScannerFrame({
  photoUri,
  cameraLayout,
  scannerFrameLayout,
}: CropPhotoToScannerFrameInput) {
  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");

  const imageInfo = await manipulateAsync(photoUri, [], {
    compress: 1,
    format: SaveFormat.JPEG,
  });

  const cropRect = getImageCropFromPreviewFrame({
    imageWidth: imageInfo.width,
    imageHeight: imageInfo.height,
    cameraLayout,
    scannerFrameLayout,
  });

  const cropped = await manipulateAsync(photoUri, [{ crop: cropRect }], {
    compress: 0.95,
    format: SaveFormat.JPEG,
  });

  if (__DEV__) {
    console.log("[SCAN DEBUG] scanner frame crop", {
      photoUri,
      croppedUri: cropped.uri,
      imageWidth: imageInfo.width,
      imageHeight: imageInfo.height,
      cameraLayout,
      scannerFrameLayout,
      cropRect,
      croppedWidth: cropped.width,
      croppedHeight: cropped.height,
    });
  }

  return cropped;
}

const DEBUG_DIRECTORY = new Directory(Paths.cache, "riftbound-scan-debug");

const CROP_RATIOS = {
  "full-card": {
    x: 0.0,
    y: 0.0,
    width: 1.0,
    height: 1.0,
  },

  artwork: {
    x: 0.0,
    y: 0.0,
    width: 1.0,
    height: 0.52,
  },

  "name-band": {
    x: 0.02,
    y: 0.36,
    width: 0.96,
    height: 0.28,
  },

  "collector-bottom": {
    x: 0.0,
    y: 0.8,
    width: 1.0,
    height: 0.19,
  },
} as const;

function ensureDebugDirectory() {
  if (!DEBUG_DIRECTORY.exists) {
    DEBUG_DIRECTORY.create({
      idempotent: true,
      intermediates: true,
    });
  }
}

function getCropRect(
  image: { width: number; height: number },
  kind: ScanDebugCropKind,
) {
  const ratio = CROP_RATIOS[kind];

  return {
    originX: Math.round(image.width * ratio.x),
    originY: Math.round(image.height * ratio.y),
    width: Math.round(image.width * ratio.width),
    height: Math.round(image.height * ratio.height),
  };
}

export async function cropScanImage(photoUri: string, kind: ScanDebugCropKind) {
  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");

  const imageInfo = await manipulateAsync(photoUri, [], {
    compress: 1,
    format: SaveFormat.JPEG,
  });

  const cropRect = getCropRect(imageInfo, kind);

  const croppedImage = await manipulateAsync(photoUri, [{ crop: cropRect }], {
    compress: 0.95,
    format: SaveFormat.JPEG,
  });

  if (__DEV__) {
    console.log(`[SCAN DEBUG] crop ${kind}`, {
      source: photoUri,
      cropUri: croppedImage.uri,
      sourceWidth: imageInfo.width,
      sourceHeight: imageInfo.height,
      cropRect,
      cropWidth: croppedImage.width,
      cropHeight: croppedImage.height,
    });
  }

  return croppedImage;
}

export async function normalizePhotoForScan(photoUri: string) {
  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");

  const imageInfo = await manipulateAsync(photoUri, [], {
    compress: 1,
    format: SaveFormat.JPEG,
  });

  const shouldRotate = imageInfo.width > imageInfo.height;

  const normalized = shouldRotate
    ? await manipulateAsync(photoUri, [{ rotate: -90 }], {
        compress: 0.95,
        format: SaveFormat.JPEG,
      })
    : imageInfo;

  if (__DEV__) {
    console.log("[SCAN DEBUG] normalize photo", {
      originalUri: photoUri,
      normalizedUri: normalized.uri,
      originalWidth: imageInfo.width,
      originalHeight: imageInfo.height,
      normalizedWidth: normalized.width,
      normalizedHeight: normalized.height,
      rotation: shouldRotate ? -90 : 0,
    });
  }

  return normalized;
}

export async function createScanDebugImages(photoUri: string) {
  ensureDebugDirectory();

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

  if (__DEV__) {
    console.log("[SCAN DEBUG] images:", images);
  }

  return images;
}

export async function shareScanDebugImage(image: ScanDebugImage) {
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    console.log("[SCAN DEBUG] sharing unavailable:", image);
    return;
  }

  await Sharing.shareAsync(image.uri, {
    dialogTitle: `Share ${image.label}`,
  });
}
