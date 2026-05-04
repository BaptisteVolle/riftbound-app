import { Directory, File, Paths } from "expo-file-system";
import { Buffer } from "buffer";
import { decode } from "jpeg-js";
import { RiftboundCard } from "../cards/cards.types";
import { cropScanImage, type ScanDebugCropKind } from "./scan-debug.service";

type ImageSignature = {
  pixels: Uint8Array;
};

export type ImageMatchResult = {
  card: RiftboundCard;
  similarity: number;
  margin: number;
};

type ImageSignatureOptions = {
  cropKind?: ScanDebugCropKind;
};

const THUMBNAIL_SIZE = 32;
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
    IMAGE_CACHE_DIRECTORY.create({ idempotent: true, intermediates: true });
  }
}

async function getLocalImageUri(uri: string) {
  if (!/^https?:\/\//i.test(uri)) {
    return uri;
  }

  ensureImageCacheDirectory();

  const imageFile = new File(IMAGE_CACHE_DIRECTORY, getSafeFileName(uri));

  if (!imageFile.exists) {
    await File.downloadFileAsync(uri, imageFile, { idempotent: true });
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

  if (__DEV__) {
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

export async function findBestImageMatch(
  photoUri: string,
  candidates: RiftboundCard[],
  options: ImageSignatureOptions = { cropKind: "artwork" },
): Promise<ImageMatchResult | undefined> {
  const imageCandidates = candidates.filter(
    (candidate): candidate is RiftboundCard & { imageUrl: string } =>
      Boolean(candidate.imageUrl),
  );

  if (!photoUri || imageCandidates.length < 2) {
    return undefined;
  }

  try {
    const photoSignature = await getImageSignature(photoUri, options);
    const scoredCandidates: ImageMatchResult[] = [];

    for (const candidate of imageCandidates.slice(0, 8)) {
      try {
        const candidateSignature = await getImageSignature(candidate.imageUrl, {
          cropKind: "artwork",
        });
        scoredCandidates.push({
          card: candidate,
          similarity: compareSignatures(photoSignature, candidateSignature),
          margin: 0,
        });
      } catch {
        // Some remote candidate images may be unavailable. Keep the scan usable.
      }
    }

    const sortedMatches = scoredCandidates.sort(
      (left, right) => right.similarity - left.similarity,
    );

    if (__DEV__) {
      console.log(
        "[IMAGE] scored candidates:",
        sortedMatches.map((match) => ({
          name: match.card.name,
          setCode: match.card.setCode,
          number: match.card.number,
          imageUrl: match.card.imageUrl,
          similarity: Number(match.similarity.toFixed(4)),
        })),
      );

      const [best, second] = sortedMatches;

      console.log("[IMAGE] best match summary:", {
        best: best
          ? {
              name: best.card.name,
              setCode: best.card.setCode,
              number: best.card.number,
              similarity: Number(best.similarity.toFixed(4)),
            }
          : undefined,
        second: second
          ? {
              name: second.card.name,
              setCode: second.card.setCode,
              number: second.card.number,
              similarity: Number(second.similarity.toFixed(4)),
            }
          : undefined,
        margin: best
          ? Number((best.similarity - (second?.similarity ?? 0)).toFixed(4))
          : undefined,
      });
    }

    const [bestMatch, secondBestMatch] = sortedMatches;

    if (!bestMatch) {
      return undefined;
    }

    return {
      ...bestMatch,
      margin: bestMatch.similarity - (secondBestMatch?.similarity ?? 0),
    };
  } catch {
    return undefined;
  }
}
