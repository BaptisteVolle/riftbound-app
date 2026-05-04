// src/features/scan/ocr-layout.service.ts

import type {
  TextLine,
  TextRecognitionResult,
} from "@react-native-ml-kit/text-recognition";

export type PositionedTextLine = {
  text: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  rawLine: TextLine;
};

export type OcrRegion = {
  minTop?: number;
  maxTop?: number;
  minBottom?: number;
  maxBottom?: number;
  minLeft?: number;
  maxLeft?: number;
  minRight?: number;
  maxRight?: number;
};

function getLineFrame(line: TextLine) {
  if (!line.frame) {
    return undefined;
  }

  return {
    top: line.frame.top,
    bottom: line.frame.top + line.frame.height,
    left: line.frame.left,
    right: line.frame.left + line.frame.width,
    width: line.frame.width,
    height: line.frame.height,
  };
}

function isInRegion(line: PositionedTextLine, region: OcrRegion) {
  if (region.minTop !== undefined && line.top < region.minTop) return false;
  if (region.maxTop !== undefined && line.top > region.maxTop) return false;
  if (region.minBottom !== undefined && line.bottom < region.minBottom)
    return false;
  if (region.maxBottom !== undefined && line.bottom > region.maxBottom)
    return false;
  if (region.minLeft !== undefined && line.left < region.minLeft) return false;
  if (region.maxLeft !== undefined && line.left > region.maxLeft) return false;
  if (region.minRight !== undefined && line.right < region.minRight)
    return false;
  if (region.maxRight !== undefined && line.right > region.maxRight)
    return false;

  return true;
}

export function getPositionedTextLines(
  result: TextRecognitionResult,
): PositionedTextLine[] {
  const rawLines = result.blocks
    .flatMap((block) => block.lines)
    .filter((line) => Boolean(line.text.trim() && line.frame));

  if (rawLines.length === 0) {
    return [];
  }

  const frames = rawLines
    .map(getLineFrame)
    .filter((frame): frame is NonNullable<ReturnType<typeof getLineFrame>> =>
      Boolean(frame),
    );

  const maxRight = Math.max(...frames.map((frame) => frame.right), 1);
  const maxBottom = Math.max(...frames.map((frame) => frame.bottom), 1);

  return rawLines
    .map((line) => {
      const frame = getLineFrame(line);

      if (!frame) {
        return undefined;
      }

      return {
        text: line.text.trim(),
        top: frame.top / maxBottom,
        bottom: frame.bottom / maxBottom,
        left: frame.left / maxRight,
        right: frame.right / maxRight,
        width: frame.width / maxRight,
        height: frame.height / maxBottom,
        rawLine: line,
      };
    })
    .filter((line): line is PositionedTextLine => Boolean(line))
    .sort((left, right) => left.top - right.top || left.left - right.left);
}

export function getRegionLines(lines: PositionedTextLine[], region: OcrRegion) {
  return lines.filter((line) => isInRegion(line, region));
}

export function getRegionText(lines: PositionedTextLine[], region: OcrRegion) {
  return getRegionLines(lines, region)
    .flatMap((line) => [
      line.text,
      ...line.rawLine.elements.map((element) => element.text),
    ])
    .join(" ")
    .trim();
}
