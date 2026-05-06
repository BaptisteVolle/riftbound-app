import { normalizeScanCardImageRegion } from "./scan-normalized-image.service";
import type {
  CardImageSignatureV1,
  ScanCardImageRegion,
} from "./scan-image-signature.types";

export const CARD_IMAGE_SIGNATURE_VERSION = 1;
export const CARD_IMAGE_THUMBNAIL_SIZE = 32;
export const CARD_IMAGE_HISTOGRAM_BINS = 64;

type CardImageSignatureComparison = {
  score: number;
  rgbSimilarity: number;
  dHashSimilarity: number;
  histogramSimilarity: number;
};

const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;
const HISTOGRAM_CHANNEL_BINS = 4;

const signatureCache = new Map<string, CardImageSignatureV1>();

function getRegionCacheKey(region: ScanCardImageRegion) {
  return [
    region.uri,
    region.cropKind,
    region.source,
    region.layout,
    region.rotationDegrees ?? 0,
    CARD_IMAGE_SIGNATURE_VERSION,
  ].join(":");
}

function getGrayscaleValue(rgb: Uint8Array, pixelIndex: number) {
  const sourceIndex = pixelIndex * 3;

  return (
    rgb[sourceIndex] * 0.299 +
    rgb[sourceIndex + 1] * 0.587 +
    rgb[sourceIndex + 2] * 0.114
  );
}

function getDifferenceHash(rgb: Uint8Array) {
  let bits = "";

  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    for (let x = 0; x < DHASH_WIDTH - 1; x += 1) {
      const leftPixelIndex = y * DHASH_WIDTH + x;
      const rightPixelIndex = leftPixelIndex + 1;

      bits +=
        getGrayscaleValue(rgb, leftPixelIndex) >
        getGrayscaleValue(rgb, rightPixelIndex)
          ? "1"
          : "0";
    }
  }

  let hash = "";

  for (let index = 0; index < bits.length; index += 4) {
    hash += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }

  return hash.padStart(16, "0");
}

function getColorHistogram(rgb: Uint8Array) {
  const histogram = Array.from({ length: CARD_IMAGE_HISTOGRAM_BINS }, () => 0);
  const pixelCount = rgb.length / 3;

  for (let index = 0; index < pixelCount; index += 1) {
    const sourceIndex = index * 3;
    const redBin = Math.min(
      HISTOGRAM_CHANNEL_BINS - 1,
      Math.floor(rgb[sourceIndex] / 64),
    );
    const greenBin = Math.min(
      HISTOGRAM_CHANNEL_BINS - 1,
      Math.floor(rgb[sourceIndex + 1] / 64),
    );
    const blueBin = Math.min(
      HISTOGRAM_CHANNEL_BINS - 1,
      Math.floor(rgb[sourceIndex + 2] / 64),
    );
    const histogramIndex =
      redBin * HISTOGRAM_CHANNEL_BINS * HISTOGRAM_CHANNEL_BINS +
      greenBin * HISTOGRAM_CHANNEL_BINS +
      blueBin;

    histogram[histogramIndex] += 1;
  }

  return histogram.map((value) => value / pixelCount);
}

function compareRgbTiny(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);

  if (length === 0) {
    return 0;
  }

  let totalDifference = 0;

  for (let index = 0; index < length; index += 1) {
    totalDifference += Math.abs(left[index] - right[index]);
  }

  return 1 - totalDifference / (length * 255);
}

function getHammingDistance(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length) * 4;

  for (let index = 0; index < length; index += 1) {
    const leftNibble = Number.parseInt(left[index], 16);
    const rightNibble = Number.parseInt(right[index], 16);
    let diff = leftNibble ^ rightNibble;

    while (diff > 0) {
      distance += diff & 1;
      diff >>= 1;
    }
  }

  return distance;
}

function compareDifferenceHash(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  return 1 - getHammingDistance(left, right) / 64;
}

function compareColorHistogram(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);

  if (length === 0) {
    return 0;
  }

  let intersection = 0;

  for (let index = 0; index < length; index += 1) {
    intersection += Math.min(left[index], right[index]);
  }

  return intersection;
}

export async function createCardImageSignature(
  region: ScanCardImageRegion,
): Promise<CardImageSignatureV1> {
  const cacheKey = getRegionCacheKey(region);
  const cachedSignature = signatureCache.get(cacheKey);

  if (cachedSignature) {
    return cachedSignature;
  }

  const [rgbTinyImage, dHashImage] = await Promise.all([
    normalizeScanCardImageRegion(region, {
      width: CARD_IMAGE_THUMBNAIL_SIZE,
      height: CARD_IMAGE_THUMBNAIL_SIZE,
    }),
    normalizeScanCardImageRegion(region, {
      width: DHASH_WIDTH,
      height: DHASH_HEIGHT,
    }),
  ]);

  const signature = {
    rgbTiny: Array.from(rgbTinyImage.rgb),
    dHash: getDifferenceHash(dHashImage.rgb),
    colorHistogram: getColorHistogram(rgbTinyImage.rgb),
  };

  signatureCache.set(cacheKey, signature);

  return signature;
}

export function compareCardImageSignatures(
  left: CardImageSignatureV1,
  right: CardImageSignatureV1,
): CardImageSignatureComparison {
  const rgbSimilarity = compareRgbTiny(left.rgbTiny, right.rgbTiny);
  const dHashSimilarity = compareDifferenceHash(left.dHash, right.dHash);
  const histogramSimilarity = compareColorHistogram(
    left.colorHistogram,
    right.colorHistogram,
  );

  return {
    rgbSimilarity,
    dHashSimilarity,
    histogramSimilarity,
    score:
      0.9 * rgbSimilarity +
      0.1 * dHashSimilarity +
      0.00 * histogramSimilarity,
  };
}
