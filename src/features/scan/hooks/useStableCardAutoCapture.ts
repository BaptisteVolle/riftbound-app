import { useCallback, useRef, useState } from "react";

import {
  SCAN_AUTO_CAPTURE_COOLDOWN_MS,
  SCAN_AUTO_CAPTURE_STABLE_FRAMES,
  SCAN_OPENCV_DEBUG,
} from "../debug/scan-debug-flag";
import type {
  CardDetectionResult,
  CardStabilityState,
} from "../scan-logic/card-detection.types";

const MIN_DETECTION_CONFIDENCE = 0.68;
const MIN_BLUR_SCORE = 0.18;
const MIN_BRIGHTNESS_SCORE = 0.62;
const MAX_CENTER_DRIFT = 0.035;
const MAX_AREA_DRIFT = 0.055;

function getRegionCenter(result: CardDetectionResult) {
  const [topLeft, topRight, bottomRight, bottomLeft] = result.corners;

  return {
    x: (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4,
    y: (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4,
  };
}

function isSameStableRegion(
  previous: CardDetectionResult | undefined,
  next: CardDetectionResult,
) {
  if (!previous) {
    return true;
  }

  const previousCenter = getRegionCenter(previous);
  const nextCenter = getRegionCenter(next);
  const frameWidth = Math.max(1, next.frameSize.width);
  const frameHeight = Math.max(1, next.frameSize.height);
  const centerDrift =
    Math.abs(previousCenter.x - nextCenter.x) / frameWidth +
    Math.abs(previousCenter.y - nextCenter.y) / frameHeight;
  const areaDrift = Math.abs(previous.areaRatio - next.areaRatio);

  return centerDrift <= MAX_CENTER_DRIFT && areaDrift <= MAX_AREA_DRIFT;
}

function isCaptureReadyRegion(region: CardDetectionResult) {
  return (
    region.confidence >= MIN_DETECTION_CONFIDENCE &&
    region.blurScore >= MIN_BLUR_SCORE &&
    region.brightnessScore >= MIN_BRIGHTNESS_SCORE &&
    region.orientation === "portrait"
  );
}

export function useStableCardAutoCapture({
  enabled,
  isBusy,
  onCapture,
}: {
  enabled: boolean;
  isBusy: boolean;
  onCapture: () => void;
}) {
  const lastRegionRef = useRef<CardDetectionResult | undefined>(undefined);
  const stableFramesRef = useRef(0);
  const lastCaptureAtRef = useRef(0);
  const [status, setStatus] = useState<CardStabilityState>({
    stableFrames: 0,
    isCoolingDown: false,
  });

  const handleDetectedCardFrame = useCallback(
    (region: CardDetectionResult | undefined) => {
      const now = Date.now();
      const isCoolingDown =
        now - lastCaptureAtRef.current < SCAN_AUTO_CAPTURE_COOLDOWN_MS;

      if (!enabled || isBusy || isCoolingDown || !region) {
        stableFramesRef.current = 0;
        if (!region) {
          lastRegionRef.current = undefined;
        }
        setStatus({
          stableFrames: stableFramesRef.current,
          isCoolingDown,
          latestResult: region,
        });
        return;
      }

      if (!isCaptureReadyRegion(region)) {
        stableFramesRef.current = 0;
        lastRegionRef.current = region;
        setStatus({
          stableFrames: 0,
          isCoolingDown,
          latestResult: region,
        });
        return;
      }

      stableFramesRef.current = isSameStableRegion(
        lastRegionRef.current,
        region,
      )
        ? stableFramesRef.current + 1
        : 1;
      lastRegionRef.current = region;

      if (SCAN_OPENCV_DEBUG) {
        console.log("[SCAN DETECTION] stable candidate", {
          areaRatio: Number(region.areaRatio.toFixed(4)),
          aspectRatio: Number(region.aspectRatio.toFixed(4)),
          blurScore: Number(region.blurScore.toFixed(4)),
          brightnessScore: Number(region.brightnessScore.toFixed(4)),
          confidence: Number(region.confidence.toFixed(4)),
          orientation: region.orientation,
          stableFrames: stableFramesRef.current,
          corners: region.corners.map((corner) => ({
            x: Math.round(corner.x),
            y: Math.round(corner.y),
          })),
        });
      }

      setStatus({
        stableFrames: stableFramesRef.current,
        isCoolingDown,
        latestResult: region,
      });

      if (stableFramesRef.current >= SCAN_AUTO_CAPTURE_STABLE_FRAMES) {
        lastCaptureAtRef.current = now;
        stableFramesRef.current = 0;
        onCapture();
      }
    },
    [enabled, isBusy, onCapture],
  );

  const resetAutoCapture = useCallback(() => {
    lastRegionRef.current = undefined;
    stableFramesRef.current = 0;
    setStatus({ stableFrames: 0, isCoolingDown: false });
  }, []);

  return {
    handleDetectedCardFrame,
    resetAutoCapture,
    status,
  };
}
