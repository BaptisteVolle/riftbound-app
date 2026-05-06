import {
  BorderTypes,
  ColorConversionCodes,
  ContourApproximationModes,
  DataTypes,
  ObjectType,
  OpenCV,
  RetrievalModes,
} from "react-native-fast-opencv";

import type {
  CardDetectionFrameInput,
  CardDetectionPoint,
  CardDetectionResult,
} from "./card-detection.types";

const MIN_CARD_AREA_RATIO = 0.12;
const MAX_CARD_AREA_RATIO = 0.86;
const CARD_RATIO = 1039 / 744;
const CARD_RATIO_TOLERANCE = 0.34;
let detectionDebugCount = 0;
let skippedFrameDebugCount = 0;

type PointArray = { x: number; y: number }[];

function clamp01(value: number) {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

function distance(a: CardDetectionPoint, b: CardDetectionPoint) {
  "worklet";
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function orderCorners(points: PointArray): CardDetectionResult["corners"] {
  "worklet";
  const ordered = points.slice(0, 4);
  ordered.sort((a, b) => a.x + a.y - (b.x + b.y));

  const topLeft = ordered[0];
  const bottomRight = ordered[3];
  const middle = [ordered[1], ordered[2]];
  middle.sort((a, b) => a.y - a.x - (b.y - b.x));

  return [topLeft, middle[0], bottomRight, middle[1]];
}

function getBoundingBox(
  corners: CardDetectionResult["corners"],
): CardDetectionResult["boundingBox"] {
  "worklet";
  const minX = Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
  const minY = Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
  const maxX = Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
  const maxY = Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getAspectRatio(corners: CardDetectionResult["corners"]) {
  "worklet";
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const topWidth = distance(topLeft, topRight);
  const bottomWidth = distance(bottomLeft, bottomRight);
  const leftHeight = distance(topLeft, bottomLeft);
  const rightHeight = distance(topRight, bottomRight);
  const width = (topWidth + bottomWidth) / 2;
  const height = (leftHeight + rightHeight) / 2;

  if (!width || !height) {
    return 0;
  }

  return Math.max(width, height) / Math.min(width, height);
}

function getCenterScore(
  corners: CardDetectionResult["corners"],
  width: number,
  height: number,
) {
  "worklet";
  const centerX =
    (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
  const centerY =
    (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
  const dx = Math.abs(centerX / width - 0.5);
  const dy = Math.abs(centerY / height - 0.5);

  return clamp01(1 - (dx + dy) * 2.2);
}

function getBrightnessScore(data: Uint8Array, channels: number) {
  "worklet";
  let sampled = 0;
  let tooDark = 0;
  let tooBright = 0;

  for (let index = 0; index < data.length; index += channels * 96) {
    const blue = data[index] ?? 0;
    const green = data[index + 1] ?? blue;
    const red = data[index + 2] ?? green;
    const luminance = (red + green + blue) / 3;

    sampled += 1;
    if (luminance < 28) {
      tooDark += 1;
    } else if (luminance > 235) {
      tooBright += 1;
    }
  }

  if (!sampled) {
    return 0;
  }

  return clamp01(1 - (tooDark + tooBright) / sampled);
}

function getEdgeScore(edgeBuffer: Uint8Array) {
  "worklet";
  let sampled = 0;
  let edgePixels = 0;

  for (let index = 0; index < edgeBuffer.length; index += 64) {
    sampled += 1;
    if ((edgeBuffer[index] ?? 0) > 0) {
      edgePixels += 1;
    }
  }

  if (!sampled) {
    return 0;
  }

  return clamp01((edgePixels / sampled) * 18);
}

export function detectCardInFrame(
  input: CardDetectionFrameInput,
): CardDetectionResult | undefined {
  "worklet";

  const { channels, data, height, width } = input;

  try {
    const src = OpenCV.bufferToMat("uint8", height, width, channels, data);
    const gray = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
    const blurred = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
    const edges = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
    const kernelSize = OpenCV.createObject(ObjectType.Size, 5, 5);

    OpenCV.invoke(
      "cvtColor",
      src,
      gray,
      channels === 4
        ? ColorConversionCodes.COLOR_BGRA2GRAY
        : ColorConversionCodes.COLOR_BGR2GRAY,
    );
    OpenCV.invoke(
      "GaussianBlur",
      gray,
      blurred,
      kernelSize,
      0,
      0,
      BorderTypes.BORDER_DEFAULT,
    );
    OpenCV.invoke("Canny", blurred, edges, 70, 170);

    const contours = OpenCV.createObject(ObjectType.PointVectorOfVectors);
    OpenCV.invoke(
      "findContours",
      edges,
      contours,
      RetrievalModes.RETR_EXTERNAL,
      ContourApproximationModes.CHAIN_APPROX_SIMPLE,
    );

    const edgeBuffer = OpenCV.matToBuffer(edges, "uint8").buffer;
    const blurScore = getEdgeScore(edgeBuffer);
    const brightnessScore = getBrightnessScore(data, channels);
    const contourValues = OpenCV.toJSValue(contours).array;
    const frameArea = width * height;
    let bestResult: CardDetectionResult | undefined;
    let bestScore = 0;
    let areaCandidateCount = 0;
    let quadCandidateCount = 0;

    for (let index = 0; index < contourValues.length; index += 1) {
      const contour = OpenCV.copyObjectFromVector(contours, index);
      const areaRatio = OpenCV.invoke("contourArea", contour).value / frameArea;

      if (areaRatio < MIN_CARD_AREA_RATIO || areaRatio > MAX_CARD_AREA_RATIO) {
        continue;
      }
      areaCandidateCount += 1;

      const perimeter = OpenCV.invoke("arcLength", contour, true).value;
      const approx = OpenCV.createObject(ObjectType.PointVector);
      OpenCV.invoke("approxPolyDP", contour, approx, perimeter * 0.025, true);

      const points = OpenCV.toJSValue(approx).array;
      if (points.length !== 4) {
        continue;
      }
      quadCandidateCount += 1;

      const corners = orderCorners(points);
      const aspectRatio = getAspectRatio(corners);
      const aspectScore = clamp01(
        1 - Math.abs(aspectRatio - CARD_RATIO) / CARD_RATIO_TOLERANCE,
      );
      const centerScore = getCenterScore(corners, width, height);
      const areaScore = clamp01((areaRatio - MIN_CARD_AREA_RATIO) * 2.5);
      const confidence =
        0.44 * aspectScore +
        0.26 * centerScore +
        0.18 * areaScore +
        0.12 * blurScore;

      if (confidence > bestScore) {
        bestScore = confidence;
        bestResult = {
          corners,
          boundingBox: getBoundingBox(corners),
          confidence,
          blurScore,
          brightnessScore,
          orientation:
            distance(corners[0], corners[1]) >
            distance(corners[0], corners[3])
              ? "landscape"
              : "portrait",
          frameSize: { width, height },
          areaRatio,
          aspectRatio,
        };
      }
    }

    if (detectionDebugCount < 8) {
      detectionDebugCount += 1;
      console.log("[SCAN DETECTION] frame result", {
        areaCandidates: areaCandidateCount,
        blurScore: Number(blurScore.toFixed(4)),
        brightnessScore: Number(brightnessScore.toFixed(4)),
        confidence: bestResult
          ? Number(bestResult.confidence.toFixed(4))
          : undefined,
        contours: contourValues.length,
        height,
        orientation: bestResult?.orientation,
        quadCandidates: quadCandidateCount,
        sourcePixelFormat: input.sourceFrame.pixelFormat,
        width,
      });
    }

    OpenCV.clearBuffers([]);
    return bestResult;
  } catch (error) {
    if (skippedFrameDebugCount < 8) {
      skippedFrameDebugCount += 1;
      console.log("[SCAN DETECTION] skipped frame", {
        error:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "unknown",
        height,
        sourcePixelFormat: input.sourceFrame.pixelFormat,
        width,
      });
    }
    OpenCV.clearBuffers([]);
    return undefined;
  }
}
