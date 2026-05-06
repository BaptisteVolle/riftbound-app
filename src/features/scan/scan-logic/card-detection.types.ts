import type { ScanCardLayout } from "./scan-image-signature.types";

export type CardDetectionPoint = {
  x: number;
  y: number;
};

export type CardDetectionBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CardDetectionFrameInput = {
  data: Uint8Array;
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  sourceFrame: {
    width: number;
    height: number;
    pixelFormat: string;
  };
};

export type CardDetectionResult = {
  corners: [
    CardDetectionPoint,
    CardDetectionPoint,
    CardDetectionPoint,
    CardDetectionPoint,
  ];
  boundingBox: CardDetectionBoundingBox;
  confidence: number;
  blurScore: number;
  brightnessScore: number;
  orientation: ScanCardLayout;
  frameSize: {
    width: number;
    height: number;
  };
  areaRatio: number;
  aspectRatio: number;
};

export type CardStabilityState = {
  stableFrames: number;
  isCoolingDown: boolean;
  latestResult?: CardDetectionResult;
};
