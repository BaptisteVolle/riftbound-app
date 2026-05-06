#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { decode } from "jpeg-js";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, "..");
const INDEX_PATH = path.join(
  ROOT,
  "src/features/scan/generated/card-image-index.ts",
);
const CACHE_DIR = path.join(ROOT, "tools/.cache/card-images");
const THUMBNAIL_SIZE = 32;
const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;
const HISTOGRAM_BINS = 64;
const HISTOGRAM_CHANNEL_BINS = 4;

const CROP_RATIOS = {
  artwork: { x: 0, y: 0, width: 1, height: 0.52 },
  "full-card": { x: 0, y: 0, width: 1, height: 1 },
};

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function parseEntryObjects(source) {
  const [, arrayBody = ""] =
    source.match(/CARD_IMAGE_INDEX: CardImageIndexEntry\[\] = \[([\s\S]*)\];/) ??
    [];
  const entries = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < arrayBody.length; index += 1) {
    const character = arrayBody[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      if (depth === 0) {
        start = index;
      }

      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0 && start >= 0) {
        entries.push(arrayBody.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return entries;
}

function parseStringField(objectSource, field) {
  return (
    objectSource.match(new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1] ??
    ""
  );
}

function parseNumberArrayField(objectSource, field) {
  const [, arraySource = ""] =
    objectSource.match(new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\]`)) ?? [];

  if (!arraySource.trim()) {
    return [];
  }

  return arraySource.split(",").map((value) => Number(value.trim()));
}

async function loadIndexEntries() {
  const source = await readFile(INDEX_PATH, "utf8");

  return parseEntryObjects(source).map((objectSource) => ({
    cardId: parseStringField(objectSource, "cardId"),
    name: parseStringField(objectSource, "name"),
    setCode: parseStringField(objectSource, "setCode"),
    number: parseStringField(objectSource, "number"),
    imageUrl: parseStringField(objectSource, "imageUrl"),
    cropKind: parseStringField(objectSource, "cropKind"),
    layout: parseStringField(objectSource, "layout"),
    signature: {
      rgbTiny: parseNumberArrayField(objectSource, "rgbTiny"),
      dHash: parseStringField(objectSource, "dHash"),
      colorHistogram: parseNumberArrayField(objectSource, "colorHistogram"),
    },
  }));
}

function getCachePath(imageUrl) {
  const url = new URL(imageUrl);
  const extension = [".jpg", ".jpeg", ".png", ".webp"].includes(
    path.extname(url.pathname).toLowerCase(),
  )
    ? path.extname(url.pathname).toLowerCase()
    : ".jpg";
  const hash = createHash("sha256").update(imageUrl).digest("hex");

  return path.join(CACHE_DIR, `${hash}${extension}`);
}

async function getImageDimensions(imagePath) {
  const { stdout } = await execFileAsync("sips", [
    "-g",
    "pixelWidth",
    "-g",
    "pixelHeight",
    imagePath,
  ]);
  const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
  const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);

  if (!width || !height) {
    throw new Error(`Could not read dimensions for ${imagePath}`);
  }

  return { width, height };
}

function getCropRect(dimensions, cropKind) {
  const ratio = CROP_RATIOS[cropKind];
  const width = Math.round(dimensions.width * ratio.width);
  const height = Math.round(dimensions.height * ratio.height);
  const originX = Math.round(dimensions.width * ratio.x);
  const originY = Math.round(dimensions.height * ratio.y);

  return {
    width,
    height,
    // sips cropOffset is relative to the centered crop, not the top-left corner.
    offsetX: Math.round(originX + width / 2 - dimensions.width / 2),
    offsetY: Math.round(originY + height / 2 - dimensions.height / 2),
  };
}

async function normalizeImageToRgb({ imagePath, cropKind, width, height, tmpPath }) {
  const dimensions = await getImageDimensions(imagePath);
  const cropRect = getCropRect(dimensions, cropKind);
  const croppedPath = path.join(tmpPath, `crop-${width}x${height}.jpg`);
  const resizedPath = path.join(tmpPath, `resize-${width}x${height}.jpg`);

  await execFileAsync("sips", [
    imagePath,
    "--cropToHeightWidth",
    String(cropRect.height),
    String(cropRect.width),
    "--cropOffset",
    String(cropRect.offsetY),
    String(cropRect.offsetX),
    "-s",
    "format",
    "jpeg",
    "--out",
    croppedPath,
  ]);
  await execFileAsync("sips", [
    croppedPath,
    "--resampleHeightWidth",
    String(height),
    String(width),
    "-s",
    "format",
    "jpeg",
    "--out",
    resizedPath,
  ]);

  const decoded = decode(await readFile(resizedPath), {
    formatAsRGBA: true,
    tolerantDecoding: true,
    useTArray: true,
  });
  const rgb = new Uint8Array(width * height * 3);

  for (let index = 0; index < width * height; index += 1) {
    const sourceIndex = index * 4;
    const targetIndex = index * 3;

    rgb[targetIndex] = decoded.data[sourceIndex];
    rgb[targetIndex + 1] = decoded.data[sourceIndex + 1];
    rgb[targetIndex + 2] = decoded.data[sourceIndex + 2];
  }

  return Array.from(rgb);
}

function getGrayscaleValue(rgb, pixelIndex) {
  const sourceIndex = pixelIndex * 3;

  return (
    rgb[sourceIndex] * 0.299 +
    rgb[sourceIndex + 1] * 0.587 +
    rgb[sourceIndex + 2] * 0.114
  );
}

function getDifferenceHash(rgb) {
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

function getColorHistogram(rgb) {
  const histogram = Array.from({ length: HISTOGRAM_BINS }, () => 0);
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

function getHammingDistance(left, right) {
  let distance = Math.abs(left.length - right.length) * 4;

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    let diff = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);

    while (diff > 0) {
      distance += diff & 1;
      diff >>= 1;
    }
  }

  return distance;
}

function getMeanAbsoluteDifference(left, right) {
  const length = Math.min(left.length, right.length);
  let totalDifference = 0;

  for (let index = 0; index < length; index += 1) {
    totalDifference += Math.abs(left[index] - right[index]);
  }

  return totalDifference / length;
}

function getHistogramIntersection(left, right) {
  let intersection = 0;

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    intersection += Math.min(left[index], right[index]);
  }

  return intersection;
}

async function createJavaScriptSignature(entry, tmpPath) {
  const imagePath = getCachePath(entry.imageUrl);

  if (!existsSync(imagePath)) {
    throw new Error(`Missing cached image for ${entry.name}: ${imagePath}`);
  }

  const rgbTiny = await normalizeImageToRgb({
    imagePath,
    cropKind: entry.cropKind,
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    tmpPath,
  });
  const dHashRgb = await normalizeImageToRgb({
    imagePath,
    cropKind: entry.cropKind,
    width: DHASH_WIDTH,
    height: DHASH_HEIGHT,
    tmpPath,
  });

  return {
    rgbTiny,
    dHash: getDifferenceHash(dHashRgb),
    colorHistogram: getColorHistogram(rgbTiny),
  };
}

async function main() {
  const limit = Number(getArgValue("--limit", "5"));
  const entries = (await loadIndexEntries()).slice(0, limit);

  if (entries.length === 0) {
    throw new Error("No generated card image index entries found.");
  }

  const tmpPath = await mkdtemp(path.join(tmpdir(), "riftbound-signature-"));
  const results = [];

  try {
    for (const entry of entries) {
      const actual = await createJavaScriptSignature(entry, tmpPath);
      results.push({
        cardId: entry.cardId,
        name: entry.name,
        dHashDistance: getHammingDistance(entry.signature.dHash, actual.dHash),
        rgbMad: Number(
          getMeanAbsoluteDifference(entry.signature.rgbTiny, actual.rgbTiny).toFixed(4),
        ),
        histogramIntersection: Number(
          getHistogramIntersection(
            entry.signature.colorHistogram,
            actual.colorHistogram,
          ).toFixed(4),
        ),
      });
    }
  } finally {
    await rm(tmpPath, { recursive: true, force: true });
  }

  console.log(JSON.stringify({ checked: results.length, results }, null, 2));

  const failures = results.filter((result) => {
    return (
      result.dHashDistance > 8 ||
      result.rgbMad > 12 ||
      result.histogramIntersection < 0.85
    );
  });

  if (failures.length > 0) {
    const message =
      "Signature compatibility check is outside tolerance. This is diagnostic unless --strict is passed.";

    if (hasArg("--strict")) {
      console.error(message);
      process.exit(1);
    }

    console.warn(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
