import { Directory, File, Paths } from 'expo-file-system';
import { Buffer } from 'buffer';
import { decode } from 'jpeg-js';

import { RiftboundCard } from '../cards/cards.types';

type ImageSignature = {
  pixels: Uint8Array;
};

export type ImageMatchResult = {
  card: RiftboundCard;
  similarity: number;
  margin: number;
};

const THUMBNAIL_SIZE = 16;
const IMAGE_CACHE_DIRECTORY = new Directory(Paths.cache, 'riftbound-card-images');
const signatureCache = new Map<string, ImageSignature>();

function getImageExtension(value: string) {
  const pathname = value.split('?')[0] ?? '';
  const extension = pathname.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase();

  if (!extension) {
    return 'jpg';
  }

  return extension === 'jpeg' ? 'jpg' : extension;
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
  return decode(Buffer.from(base64, 'base64'), {
    formatAsRGBA: true,
    tolerantDecoding: true,
    useTArray: true,
  });
}

async function getImageSignature(uri: string) {
  const cachedSignature = signatureCache.get(uri);

  if (cachedSignature) {
    return cachedSignature;
  }

  const localUri = await getLocalImageUri(uri);
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const normalizedImage = await manipulateAsync(
    localUri,
    [{ resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }],
    {
      base64: true,
      compress: 0.85,
      format: SaveFormat.JPEG,
    },
  );

  if (!normalizedImage.base64) {
    throw new Error('Image signature could not be created.');
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
  signatureCache.set(uri, signature);

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
): Promise<ImageMatchResult | undefined> {
  const imageCandidates = candidates.filter((candidate) => candidate.imageUrl);

  if (!photoUri || imageCandidates.length < 2) {
    return undefined;
  }

  try {
    const photoSignature = await getImageSignature(photoUri);
    const scoredCandidates: ImageMatchResult[] = [];

    for (const candidate of imageCandidates.slice(0, 8)) {
      try {
        const candidateSignature = await getImageSignature(candidate.imageUrl ?? '');
        scoredCandidates.push({
          card: candidate,
          similarity: compareSignatures(photoSignature, candidateSignature),
          margin: 0,
        });
      } catch {
        // Some remote candidate images may be unavailable. Keep the scan usable.
      }
    }

    const [bestMatch, secondBestMatch] = scoredCandidates.sort(
      (left, right) => right.similarity - left.similarity,
    );

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
