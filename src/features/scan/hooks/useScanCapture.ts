import type { CameraView } from "expo-camera";
import type { RefObject } from "react";
import type { LayoutRectangle } from "react-native";

import { SCAN_IMAGE_DEBUG } from "../debug/scan-debug-flag";
import {
  cropPhotoToScannerFrame,
  normalizePhotoForScan,
} from "../scan-logic/scan-image-crop.service";

type CameraPermissionState = {
  granted: boolean;
} | null;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

export function useScanCapture({
  cameraLayout,
  cameraRef,
  isCameraReady,
  onCaptureFailed,
  onCaptureStart,
  onPhotoReady,
  permission,
  scannerFrameLayout,
  setCameraReady,
  setStatusMessage,
}: {
  cameraLayout: LayoutRectangle | undefined;
  cameraRef: RefObject<CameraView | null>;
  isCameraReady: boolean;
  onCaptureFailed: (reason: string) => void;
  onCaptureStart: () => void;
  onPhotoReady: (photoUri: string) => Promise<void>;
  permission: CameraPermissionState;
  scannerFrameLayout: LayoutRectangle | undefined;
  setCameraReady: (value: boolean) => void;
  setStatusMessage: (message: string) => void;
}) {
  async function handleCapturePhoto() {
    if (!permission?.granted) {
      setStatusMessage("Camera permission is not granted yet.");
      return;
    }

    if (!cameraRef.current) {
      setStatusMessage("Camera is still mounting. Try again in a moment.");
      return;
    }

    if (!isCameraReady) {
      setStatusMessage("Camera is still warming up. Try again in a moment.");
      return;
    }

    onCaptureStart();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.65,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        onCaptureFailed("Could not capture a photo. Try again.");
        return;
      }

      const normalizedPhoto = await normalizePhotoForScan(photo.uri);
      let photoUriForScan = normalizedPhoto.uri;

      if (cameraLayout && scannerFrameLayout) {
        const scannerFrameCrop = await cropPhotoToScannerFrame({
          photoUri: normalizedPhoto.uri,
          cameraLayout,
          scannerFrameLayout,
        });

        photoUriForScan = scannerFrameCrop.uri;
      } else if (SCAN_IMAGE_DEBUG) {
        console.warn("[SCAN DEBUG] missing scanner frame layout", {
          cameraLayout,
          scannerFrameLayout,
        });
      }

      await onPhotoReady(photoUriForScan);
    } catch (captureError) {
      const message = getErrorMessage(captureError);
      const reason = message
        ? `Camera capture failed: ${message}`
        : "Camera capture failed. Try again.";

      console.warn("Camera capture failed", captureError);
      onCaptureFailed(reason);
    }
  }

  function handleCameraReady() {
    setCameraReady(true);
    setStatusMessage("");
  }

  function handleCameraError({ message }: { message: string }) {
    setCameraReady(false);
    setStatusMessage(`Camera failed to start: ${message}`);
  }

  return {
    handleCameraError,
    handleCameraReady,
    handleCapturePhoto,
  };
}
