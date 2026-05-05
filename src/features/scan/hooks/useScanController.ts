import type { CameraView } from "expo-camera";
import { useState } from "react";
import type { RefObject } from "react";
import type { LayoutRectangle } from "react-native";

import {
  buildCardmarketSearchUrl,
  buildCardmarketUrlForCard,
} from "../../cards/cards.service";
import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import type { CollectionPrinting } from "../../collection/collection.types";
import type { ScanDebugImage } from "../debug/scan-debug.service";
import { getVisibleAlternativeCandidates } from "../scan-logic/scan-candidates.service";
import { isFoilLockedCard } from "../scan-logic/scan-text.service";
import type {
  ScanAnalysisResult,
  ScanAnalysisStep,
  ScanConfidence,
  ScanStatus,
  ScanViewMode,
} from "../scan.types";
import {
  isPriceFoilOnly,
  useCardmarketScanPrice,
} from "./useCardmarketScanPrice";
import { useScanCapture } from "./useScanCapture";
import { useScanCardmarketActions } from "./useScanCardmarketActions";
import { useScanCollectionActions } from "./useScanCollectionActions";
import { useScanRunner } from "./useScanRunner";

type CameraPermissionState = {
  granted: boolean;
} | null;

export function useScanController({
  cameraLayout,
  cameraRef,
  permission,
  scannerFrameLayout,
}: {
  cameraLayout: LayoutRectangle | undefined;
  cameraRef: RefObject<CameraView | null>;
  permission: CameraPermissionState;
  scannerFrameLayout: LayoutRectangle | undefined;
}) {
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [capturedPhotoUri, setCapturedPhotoUri] = useState("");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [lastUrl, setLastUrl] = useState("");
  const [lastUrlMode, setLastUrlMode] = useState("");
  const [canUseExactCard, setCanUseExactCard] = useState(false);
  const [collectionQuantity, setCollectionQuantity] = useState(1);
  const [collectionPrinting, setCollectionPrinting] =
    useState<CollectionPrinting>("normal");
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState("");
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<ScanAnalysisStep>();
  const [scanResult, setScanResult] = useState<ScanAnalysisResult>();
  const [isResultConfirmed, setIsResultConfirmed] = useState(false);
  const [scanDebugImages, setScanDebugImages] = useState<ScanDebugImage[]>([]);

  const successResult =
    scanResult?.status === "success" ? scanResult : undefined;
  const failedResult = scanResult?.status === "failed" ? scanResult : undefined;
  const detectedCard = successResult?.card;
  const likelyCandidates = scanResult?.candidates ?? [];

  const { cardmarketPrice, isPriceLoading, priceMessage } =
    useCardmarketScanPrice({
      canUseExactCard,
      detectedCard,
    });

  const isReviewingPhoto = Boolean(capturedPhotoUri);
  const canSearchCardmarket = Boolean(name.trim() || detectedCard?.name);
  const candidateImageUri = detectedCard?.imageUrl || capturedPhotoUri;
  const displayedName = detectedCard?.name ?? name;
  const displayedMeta = detectedCard
    ? `${detectedCard.setCode} ${detectedCard.number}`
    : [setCode, number].filter(Boolean).join(" ");
  const displayedTitle = [displayedName, displayedMeta]
    .filter(Boolean)
    .join(" | ");

  const isBusy = scanStatus === "capturing" || scanStatus === "scanning";
  const isCheckingScan = scanStatus === "scanning";
  const isFoilOnlyPrice = isPriceFoilOnly(cardmarketPrice);
  const isFoilLocked = isFoilLockedCard(detectedCard) || isFoilOnlyPrice;
  const activePrinting = isFoilLocked ? "foil" : collectionPrinting;

  const viewMode: ScanViewMode = !isReviewingPhoto
    ? "capture"
    : isCheckingScan || scanStatus === "capturing"
      ? "loading"
      : failedResult
        ? "failed"
        : "success";

  const requiresResultConfirmation = Boolean(
    successResult && successResult.confidence !== "exact" && !isResultConfirmed,
  );

  const canAddToCollection = Boolean(
    detectedCard &&
    successResult &&
    (successResult.confidence === "exact" || isResultConfirmed),
  );

  const resultGuidanceMessage = requiresResultConfirmation
    ? "Review this match, then confirm it if it looks right."
    : "";

  const shouldShowReviewStatus = Boolean(
    statusMessage && scanStatus !== "found" && scanResult?.status !== "failed",
  );

  const alternativeCandidates = getVisibleAlternativeCandidates(
    likelyCandidates,
    detectedCard,
  );

  function syncFieldsFromInput(input?: CardScanInput) {
    if (!input) {
      return;
    }

    setName(input.name ?? "");
    setSetCode(input.setCode ?? "");
    setNumber(input.number ?? "");
  }

  function resetScanResult() {
    setLastUrl("");
    setLastUrlMode("");
    setCanUseExactCard(false);
    setCollectionQuantity(1);
    setCollectionPrinting("normal");
    setCollectionMessage("");
    setIsEditPanelOpen(false);
    setStatusMessage("");
    setAnalysisStep(undefined);
    setScanResult(undefined);
    setIsResultConfirmed(false);
    setScanDebugImages([]);
  }

  function handleRetakePhoto() {
    setIsCameraReady(false);
    setCapturedPhotoUri("");
    setName("");
    setSetCode("");
    setNumber("");
    setScanStatus("idle");
    resetScanResult();
  }

  function handleEditedFields() {
    setCanUseExactCard(false);
    setCollectionMessage("");
    setLastUrl("");
    setLastUrlMode("");
    setIsEditPanelOpen(true);
    setScanResult(undefined);
    setIsResultConfirmed(false);
  }

  function applyCandidateCard(
    card: RiftboundCard,
    message = "",
    candidates = likelyCandidates,
    confidence?: Exclude<ScanConfidence, "failed">,
    input?: CardScanInput,
    allowExactCard = true,
    isConfirmed = false,
  ) {
    const nextPrinting = isFoilLockedCard(card) ? "foil" : "normal";
    const directUrl = allowExactCard
      ? buildCardmarketUrlForCard(card, {
          printing: nextPrinting,
        })
      : undefined;
    const fallbackUrl = buildCardmarketSearchUrl({ name: card.name });
    const nextInput =
      input ??
      ({
        name: card.name,
        setCode: card.setCode,
        number: card.number,
      } satisfies CardScanInput);
    const nextConfidence = confidence ?? (directUrl ? "exact" : "likely");

    setScanResult({
      status: "success",
      confidence: nextConfidence,
      card,
      candidates,
      input: nextInput,
      reason: message,
      isExactCardCandidate: Boolean(directUrl),
    });

    setCollectionQuantity(1);
    setCollectionPrinting(nextPrinting);
    setCollectionMessage("");
    setName(card.name);
    setSetCode(card.setCode);
    setNumber(card.number);
    setCanUseExactCard(Boolean(directUrl));
    setLastUrl(directUrl ?? fallbackUrl ?? "");
    setLastUrlMode(
      directUrl ? "Exact Cardmarket page ready" : "Name search ready",
    );
    setScanStatus("found");
    setIsEditPanelOpen(false);
    setStatusMessage(message);
    setAnalysisStep(undefined);
    setIsResultConfirmed(isConfirmed || nextConfidence !== "uncertain");
  }

  function applyScanAnalysisResult(result: ScanAnalysisResult) {
    setScanResult(result);

    if (result.status === "success") {
      applyCandidateCard(
        result.card,
        result.reason,
        result.candidates,
        result.confidence,
        result.input,
        result.isExactCardCandidate,
      );
      return;
    }

    syncFieldsFromInput(result.input);
    setCanUseExactCard(false);
    setCollectionMessage("");
    setScanStatus("not-found");
    setIsEditPanelOpen(true);
    setStatusMessage(result.reason);
    setAnalysisStep(undefined);
    setIsResultConfirmed(false);

    const fallbackSearchUrl = buildCardmarketSearchUrl({
      name: result.input?.name,
    });

    setLastUrl(fallbackSearchUrl ?? "");
    setLastUrlMode(fallbackSearchUrl ? "Name search ready" : "");
  }

  const scanRunner = useScanRunner({
    name,
    number,
    onResult: (result) => {
      syncFieldsFromInput(result.input);
      applyScanAnalysisResult(result);
    },
    resetScanResult,
    setAnalysisStep,
    setScanDebugImages,
    setScanStatus,
    setStatusMessage,
    setCode,
  });

  const scanCapture = useScanCapture({
    cameraLayout,
    cameraRef,
    isCameraReady,
    onCaptureFailed: (reason) => {
      setScanStatus("not-found");
      setStatusMessage(reason);
      setScanResult({
        status: "failed",
        confidence: "failed",
        candidates: [],
        reason,
      });
      setIsResultConfirmed(false);
    },
    onCaptureStart: () => {
      setScanStatus("capturing");
      resetScanResult();
      setName("");
      setSetCode("");
      setNumber("");
    },
    onPhotoReady: async (photoUri) => {
      setCapturedPhotoUri(photoUri);
      await scanRunner.runScan({ photoUri });
    },
    permission,
    scannerFrameLayout,
    setCameraReady: setIsCameraReady,
    setStatusMessage,
  });

  const collectionActions = useScanCollectionActions({
    activePrinting,
    canAddToCollection,
    collectionQuantity,
    detectedCard,
    requiresResultConfirmation,
    setCollectionMessage,
    setCollectionQuantity,
    setIsSavingCollection,
    setStatusMessage,
  });

  const cardmarketActions = useScanCardmarketActions({
    activePrinting,
    canSearchCardmarket,
    canUseExactCard,
    collectionPrinting,
    detectedCard,
    name,
    setCanUseExactCard,
    setCollectionMessage,
    setIsResultConfirmed,
    setLastUrl,
    setLastUrlMode,
    setStatusMessage,
    successResult,
  });

  return {
    state: {
      activePrinting,
      alternativeCandidates,
      analysisStep,
      canAddToCollection,
      canSearchCardmarket,
      canUseExactCard,
      candidateImageUri,
      cardmarketPrice,
      capturedPhotoUri,
      collectionMessage,
      collectionPrinting,
      collectionQuantity,
      detectedCard,
      displayedTitle,
      isBusy,
      isCameraReady,
      isCheckingScan,
      isEditPanelOpen,
      isFoilLocked,
      isPriceLoading,
      isResultConfirmed,
      isReviewingPhoto,
      isSavingCollection,
      lastUrl,
      lastUrlMode,
      likelyCandidates,
      name,
      number,
      priceMessage,
      requiresResultConfirmation,
      resultGuidanceMessage,
      scanDebugImages,
      scanResult,
      scanStatus,
      setCode,
      shouldShowReviewStatus,
      statusMessage,
      viewMode,
    },
    actions: {
      applyCandidateCard,
      handleAddToCollection: collectionActions.handleAddToCollection,
      handleCameraError: scanCapture.handleCameraError,
      handleCameraReady: scanCapture.handleCameraReady,
      handleCapturePhoto: scanCapture.handleCapturePhoto,
      handleCheckFields: scanRunner.handleCheckFields,
      handleConfirmResult: cardmarketActions.handleConfirmResult,
      handleEditedFields,
      handleRetakePhoto,
      handleRetryOcr: () => scanRunner.handleRetryOcr(capturedPhotoUri),
      handleSeePrice: cardmarketActions.handleSeePrice,
      openEditPanel: () => setIsEditPanelOpen(true),
      setCollectionPrinting,
      setIsEditPanelOpen,
      setName,
      setNumber,
      setSetCode,
      updateCollectionQuantity: collectionActions.updateCollectionQuantity,
    },
  };
}
