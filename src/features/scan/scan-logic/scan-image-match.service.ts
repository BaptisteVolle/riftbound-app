import { Buffer } from "buffer";
import { Directory, File, Paths } from "expo-file-system";
import { decode } from "jpeg-js";
import type { RiftboundCard } from "../../cards/cards.types";
import { cropScanImage } from "./scan-image-crop.service";
import { SCAN_IMAGE_DEBUG } from "../debug/scan-debug-flag";
import type {
  CardImageIndexEntry,
  ImageMatchResult,
  ScanCardImageCropKind,
  ScanCardImageRegion,
} from "./scan-image-signature.types";

export type { ImageMatchResult } from "./scan-image-signature.types";

type ImageSignature = {
  pixels: Uint8Array;
};

type ImageSignatureOptions = {
  cropKind?: ScanCardImageCropKind;
};

export type FindImageMatchesOptions = {
  candidates?: RiftboundCard[];
  topN?: number;
  cropKind?: ScanCardImageCropKind;
};

const THUMBNAIL_SIZE = 32;
const HISTOGRAM_BINS = 64;
const IMAGE_CACHE_DIRECTORY = new Directory(
  Paths.cache,
  "riftbound-card-images",
);

const signatureCache = new Map<string, ImageSignature>();

function getImageExtension(value: string) {
  const pathname = value.split("?")[0] ?? "";
  const extension = pathname.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase();

  if (!extension) {
    return "jpg";
  }

  return extension === "jpeg" ? "jpg" : extension;
}

function getSafeFileName(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return `${hash.toString(16)}.${getImageExtension(value)}`;
}

function ensureImageCacheDirectory() {
  if (!IMAGE_CACHE_DIRECTORY.exists) {
    IMAGE_CACHE_DIRECTORY.create({
      idempotent: true,
      intermediates: true,
    });
  }
}

async function getLocalImageUri(uri: string) {
  if (!/^https?:\/\//i.test(uri)) {
    return uri;
  }

  ensureImageCacheDirectory();

  const imageFile = new File(IMAGE_CACHE_DIRECTORY, getSafeFileName(uri));

  if (!imageFile.exists) {
    await File.downloadFileAsync(uri, imageFile, {
      idempotent: true,
    });
  }

  return imageFile.uri;
}

function decodeJpegBase64(base64: string) {
  return decode(Buffer.from(base64, "base64"), {
    formatAsRGBA: true,
    tolerantDecoding: true,
    useTArray: true,
  });
}

async function getImageSignature(
  uri: string,
  options: ImageSignatureOptions = {},
) {
  const cacheKey = `${uri}:${options.cropKind ?? "none"}`;
  const cachedSignature = signatureCache.get(cacheKey);

  if (cachedSignature) {
    return cachedSignature;
  }

  const localUri = await getLocalImageUri(uri);
  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");

  const signatureSource = options.cropKind
    ? (await cropScanImage(localUri, options.cropKind)).uri
    : localUri;

  if (SCAN_IMAGE_DEBUG) {
    console.log("[IMAGE] signature source:", {
      originalUri: uri,
      localUri,
      signatureSource,
      cropKind: options.cropKind ?? "none",
    });
  }

  const normalizedImage = await manipulateAsync(
    signatureSource,
    [{ resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }],
    {
      base64: true,
      compress: 0.85,
      format: SaveFormat.JPEG,
    },
  );

  if (!normalizedImage.base64) {
    throw new Error("Image signature could not be created.");
  }

  const decodedImage = decodeJpegBase64(normalizedImage.base64);
  const pixels = new Uint8Array(THUMBNAIL_SIZE * THUMBNAIL_SIZE * 3);

  for (let index = 0; index < THUMBNAIL_SIZE * THUMBNAIL_SIZE; index += 1) {
    const sourceIndex = index * 4;
    const targetIndex = index * 3;

    pixels[targetIndex] = decodedImage.data[sourceIndex];
    pixels[targetIndex + 1] = decodedImage.data[sourceIndex + 1];
    pixels[targetIndex + 2] = decodedImage.data[sourceIndex + 2];
  }

  const signature = { pixels };
  signatureCache.set(cacheKey, signature);

  return signature;
}

function compareSignatures(left: ImageSignature, right: ImageSignature) {
  let totalDifference = 0;

  for (let index = 0; index < left.pixels.length; index += 1) {
    totalDifference += Math.abs(left.pixels[index] - right.pixels[index]);
  }

  return 1 - totalDifference / (left.pixels.length * 255);
}

function getLegacyIndexEntry(
  card: RiftboundCard & { imageUrl: string },
  signature: ImageSignature,
  cropKind: ScanCardImageCropKind,
): CardImageIndexEntry {
  return {
    cardId: card.id,
    externalId: card.externalId,
    name: card.name,
    setCode: card.setCode,
    number: card.number,
    imageUrl: card.imageUrl,
    signatureVersion: 1,
    cropKind,
    layout: "portrait",
    thumbnailSize: THUMBNAIL_SIZE,
    histogramBins: HISTOGRAM_BINS,
    signature: {
      rgbTiny: Array.from(signature.pixels),
      dHash: "",
      colorHistogram: [],
    },
  };
}

function getSecondDifferentImageMatch(
  matches: ImageMatchResult[],
  bestMatch?: ImageMatchResult,
) {
  const bestImageUrl = bestMatch?.entry.imageUrl ?? "";

  return matches.find((match) => match.entry.imageUrl !== bestImageUrl);
}

function rankMatches(matches: ImageMatchResult[]) {
  const sortedMatches = matches.sort((left, right) => right.score - left.score);

  return sortedMatches.map((match, index) => {
    const secondDifferentImageMatch =
      index === 0
        ? getSecondDifferentImageMatch(sortedMatches, match)
        : undefined;

    return {
      ...match,
      margin:
        index === 0
          ? match.score - (secondDifferentImageMatch?.score ?? 0)
          : match.margin,
      rank: index + 1,
    };
  });
}

export async function findImageMatches(
  region: ScanCardImageRegion,
  options: FindImageMatchesOptions = {},
): Promise<ImageMatchResult[]> {
  const imageCandidates = (options.candidates ?? []).filter(
    (candidate): candidate is RiftboundCard & { imageUrl: string } =>
      Boolean(candidate.imageUrl),
  );

  if (!region.uri || imageCandidates.length < 2) {
    return [];
  }

  try {
    const cropKind = options.cropKind ?? region.cropKind;
    const photoSignature = await getImageSignature(region.uri, {
      cropKind,
    });
    const scoredCandidates: ImageMatchResult[] = [];

    for (const candidate of imageCandidates.slice(0, 8)) {
      try {
        const candidateSignature = await getImageSignature(candidate.imageUrl, {
          cropKind,
        });
        const score = compareSignatures(photoSignature, candidateSignature);

        scoredCandidates.push({
          card: candidate,
          entry: getLegacyIndexEntry(candidate, candidateSignature, cropKind),
          score,
          margin: 0,
          rgbSimilarity: score,
          dHashSimilarity: 0,
          histogramSimilarity: 0,
          rank: 0,
        });
      } catch {
        // Some remote candidate images may be unavailable. Keep the scan usable.
      }
    }

    const rankedMatches = rankMatches(scoredCandidates).slice(
      0,
      options.topN ?? 10,
    );

    if (SCAN_IMAGE_DEBUG) {
      console.log(
        "[IMAGE] scored candidates:",
        rankedMatches.map((match) => ({
          name: match.card.name,
          setCode: match.card.setCode,
          number: match.card.number,
          imageUrl: match.entry.imageUrl,
          rank: match.rank,
          score: Number(match.score.toFixed(4)),
          margin: Number(match.margin.toFixed(4)),
          rgbSimilarity: Number(match.rgbSimilarity.toFixed(4)),
        })),
      );

      const [best] = rankedMatches;
      const secondDifferentImageMatch = getSecondDifferentImageMatch(
        rankedMatches,
        best,
      );

      console.log("[IMAGE] best match summary:", {
        best: best
          ? {
              name: best.card.name,
              setCode: best.card.setCode,
              number: best.card.number,
              score: Number(best.score.toFixed(4)),
            }
          : undefined,
        secondDifferentImage: secondDifferentImageMatch
          ? {
              name: secondDifferentImageMatch.card.name,
              setCode: secondDifferentImageMatch.card.setCode,
              number: secondDifferentImageMatch.card.number,
              score: Number(secondDifferentImageMatch.score.toFixed(4)),
            }
          : undefined,
        margin: best ? Number(best.margin.toFixed(4)) : undefined,
        signatureVersion: 1,
        layout: region.layout,
        cropKind,
      });
    }

    return rankedMatches;
  } catch {
    return [];
  }
}

export async function findBestImageMatch(
  photoUri: string,
  candidates: RiftboundCard[],
  options: ImageSignatureOptions = { cropKind: "artwork" },
): Promise<ImageMatchResult | undefined> {
  const [bestMatch] = await findImageMatches(
    {
      uri: photoUri,
      cropKind: options.cropKind ?? "artwork",
      source: "overlay-crop",
      layout: "portrait",
    },
    {
      candidates,
      cropKind: options.cropKind ?? "artwork",
      topN: 1,
    },
  );

  return bestMatch;
}
