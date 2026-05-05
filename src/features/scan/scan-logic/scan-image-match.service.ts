import { Directory, File, Paths } from "expo-file-system";
import type { RiftboundCard } from "../../cards/cards.types";
import { SCAN_IMAGE_DEBUG } from "../debug/scan-debug-flag";
import {
  CARD_IMAGE_HISTOGRAM_BINS,
  CARD_IMAGE_THUMBNAIL_SIZE,
  compareCardImageSignatures,
  createCardImageSignature,
} from "./scan-image-signature.service";
import type {
  CardImageSignatureV1,
  CardImageIndexEntry,
  ImageMatchResult,
  ScanCardImageCropKind,
  ScanCardImageRegion,
} from "./scan-image-signature.types";

export type { ImageMatchResult } from "./scan-image-signature.types";

type ImageSignatureOptions = {
  cropKind?: ScanCardImageCropKind;
};

export type FindImageMatchesOptions = {
  candidates?: RiftboundCard[];
  topN?: number;
  cropKind?: ScanCardImageCropKind;
};

const IMAGE_CACHE_DIRECTORY = new Directory(
  Paths.cache,
  "riftbound-card-images",
);

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

async function getImageSignature(
  uri: string,
  region: Omit<ScanCardImageRegion, "uri">,
) {
  const localUri = await getLocalImageUri(uri);

  if (SCAN_IMAGE_DEBUG) {
    console.log("[IMAGE] signature source:", {
      originalUri: uri,
      localUri,
      cropKind: region.cropKind,
      layout: region.layout,
      source: region.source,
    });
  }

  return createCardImageSignature({
    ...region,
    uri: localUri,
  });
}

function getLegacyIndexEntry(
  card: RiftboundCard & { imageUrl: string },
  signature: CardImageSignatureV1,
  region: Omit<ScanCardImageRegion, "uri">,
): CardImageIndexEntry {
  return {
    cardId: card.id,
    externalId: card.externalId,
    name: card.name,
    setCode: card.setCode,
    number: card.number,
    imageUrl: card.imageUrl,
    signatureVersion: 1,
    cropKind: region.cropKind,
    layout: region.layout,
    thumbnailSize: CARD_IMAGE_THUMBNAIL_SIZE,
    histogramBins: CARD_IMAGE_HISTOGRAM_BINS,
    signature,
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
    const signatureRegion = {
      cropKind,
      source: region.source,
      layout: region.layout,
      rotationDegrees: region.rotationDegrees,
    };
    const photoSignature = await getImageSignature(region.uri, signatureRegion);
    const scoredCandidates: ImageMatchResult[] = [];

    for (const candidate of imageCandidates.slice(0, 8)) {
      try {
        const candidateSignature = await getImageSignature(
          candidate.imageUrl,
          signatureRegion,
        );
        const comparison = compareCardImageSignatures(
          photoSignature,
          candidateSignature,
        );

        scoredCandidates.push({
          card: candidate,
          entry: getLegacyIndexEntry(
            candidate,
            candidateSignature,
            signatureRegion,
          ),
          score: comparison.score,
          margin: 0,
          rgbSimilarity: comparison.rgbSimilarity,
          dHashSimilarity: comparison.dHashSimilarity,
          histogramSimilarity: comparison.histogramSimilarity,
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
          dHashSimilarity: Number(match.dHashSimilarity.toFixed(4)),
          histogramSimilarity: Number(match.histogramSimilarity.toFixed(4)),
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
