import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import type { RarityHint } from "./scan-ocr.service";

export type ScanCardLayout = "portrait" | "landscape";

export type ScanCardImageSource = "overlay-crop" | "opencv-perspective";

export type ScanCardImageCropKind = "artwork" | "full-card";

export type ScanCardImageRegion = {
  uri: string;
  cropKind: ScanCardImageCropKind;
  source: ScanCardImageSource;
  layout: ScanCardLayout;
  rotationDegrees?: 0 | 90 | 180 | 270;
};

export type CardImageSignatureV1 = {
  rgbTiny: number[];
  dHash: string;
  colorHistogram: number[];
};

export type CardImageIndexEntry = {
  cardId: string;
  externalId?: string;
  name: string;
  setCode: string;
  number: string;
  imageUrl: string;
  signatureVersion: 1;
  cropKind: ScanCardImageCropKind;
  layout: ScanCardLayout;
  thumbnailSize: 32;
  histogramBins: 64;
  signature: CardImageSignatureV1;
};

export type ImageMatchResult = {
  card: RiftboundCard;
  entry: CardImageIndexEntry;
  score: number;
  margin: number;
  rgbSimilarity: number;
  dHashSimilarity: number;
  histogramSimilarity: number;
  rank: number;
};

export type ScanDecisionInput = {
  imageMatches: ImageMatchResult[];
  ocrInput?: CardScanInput;
  candidates: RiftboundCard[];
  rarityHint?: RarityHint;
  mode: "image-first" | "text-fallback" | "manual";
};
