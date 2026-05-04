import type { CameraView } from "expo-camera";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { Linking, type LayoutRectangle } from "react-native";
import {
  buildCardmarketSearchUrl,
  buildCardmarketUrlForCard,
  getOpenableCardmarketUrlForCard,
} from "../../cards/cards.service";
import type { CardScanInput, RiftboundCard } from "../../cards/cards.types";
import { addCardToCollection } from "../../collection/collection.service";
import type { CollectionPrinting } from "../../collection/collection.types";
import {
  analyzeCardScanFromManualInput,
  analyzeCardScanFromPhoto,
} from "../scan-analysis.service";
import {
  getVisibleAlternativeCandidates,
  isFoilLockedCard,
} from "../scan-match.service";
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
import type { ScanDebugImage } from "../scan-debug.service";
import {
  createScanDebugImages,
  cropPhotoToScannerFrame,
  normalizePhotoForScan,
} from "../scan-debug.service";

type CameraPermissionState = {
  granted: boolean;
} | null;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

export function useScanController({
  cameraRef,
  permission,
  cameraLayout,
  scannerFrameLayout,
}: {
  cameraRef: RefObject<CameraView | null>;
  permission: CameraPermissionState;
  cameraLayout: LayoutRectangle | undefined;
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
    successResult?.confidence === "uncertain" && !isResultConfirmed,
  );
  const canAddToCollection = Boolean(
    detectedCard &&
    successResult &&
    (successResult.confidence === "exact" ||
      successResult.confidence === "likely" ||
      isResultConfirmed),
  );
  const resultGuidanceMessage =
    successResult?.confidence === "likely"
      ? "Likely match. Check variants if needed."
      : requiresResultConfirmation
        ? "Confirm this card before adding it to your collection."
        : "";
  const shouldShowReviewStatus = Boolean(
    statusMessage && scanStatus !== "found" && scanResult?.status !== "failed",
  );
  const alternativeCandidates = getVisibleAlternativeCandidates(
    likelyCandidates,
    detectedCard,
  );

  useEffect(() => {
    if (!detectedCard || !canUseExactCard) {
      return;
    }

    const directUrl = buildCardmarketUrlForCard(detectedCard, {
      printing: activePrinting,
    });
    const fallbackUrl = buildCardmarketSearchUrl({ name: detectedCard.name });

    setLastUrl(directUrl ?? fallbackUrl ?? "");
    setLastUrlMode(
      directUrl ? "Exact Cardmarket page ready" : "Name search ready",
    );
  }, [activePrinting, canUseExactCard, detectedCard]);

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

  function updateCollectionQuantity(delta: number) {
    setCollectionQuantity((currentQuantity) => {
      return Math.max(1, Math.min(99, currentQuantity + delta));
    });
  }

  async function handleAddToCollection() {
    if (!detectedCard || !canAddToCollection) {
      setStatusMessage(
        requiresResultConfirmation
          ? "Confirm this card before adding it to the collection."
          : "Confirm a card before adding it to the collection.",
      );
      return;
    }

    setIsSavingCollection(true);
    setCollectionMessage("");

    try {
      const entry = await addCardToCollection(
        detectedCard,
        activePrinting,
        collectionQuantity,
      );
      const total =
        activePrinting === "foil" ? entry.foilQuantity : entry.normalQuantity;
      setCollectionMessage(
        `Added ${collectionQuantity} ${activePrinting} ${
          collectionQuantity === 1 ? "copy" : "copies"
        }. Total: ${total}.`,
      );
      setStatusMessage("");
    } catch {
      setStatusMessage("Could not add this card to the collection.");
    } finally {
      setIsSavingCollection(false);
    }
  }

  async function runScan({ photoUri }: { photoUri?: string }) {
    resetScanResult();
    setScanStatus("scanning");
    setAnalysisStep("reading-text");
    setStatusMessage("Checking text...");
    if (__DEV__ && photoUri) {
      try {
        const debugImages = await createScanDebugImages(photoUri);
        setScanDebugImages(debugImages);
      } catch (debugError) {
        console.warn("[SCAN DEBUG] could not create debug images", debugError);
      }
    }

    const onStep = (step: ScanAnalysisStep, message: string) => {
      setAnalysisStep(step);
      setStatusMessage(message);
    };

    const result = photoUri
      ? await analyzeCardScanFromPhoto(photoUri, { onStep })
      : await analyzeCardScanFromManualInput(
          {
            name,
            setCode,
            number,
          },
          { onStep },
        );

    syncFieldsFromInput(result.input);
    applyScanAnalysisResult(result);
  }

  async function handleCapturePhoto() {
    if (!permission?.granted) {
      setStatusMessage("Camera permission is not granted yet.");
      return;
    }

    if (!cameraRef.current) {
      setStatusMessage("Camera is still mounting. Try again in a moment.");
      return;
    }

    if (!isCameraReady) {
      setStatusMessage("Camera is still warming up. Try again in a moment.");
      return;
    }

    setScanStatus("capturing");
    resetScanResult();
    setName("");
    setSetCode("");
    setNumber("");

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.65,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        const reason = "Could not capture a photo. Try again.";
        setScanStatus("not-found");
        setStatusMessage(reason);
        setScanResult({
          status: "failed",
          confidence: "failed",
          candidates: [],
          reason,
        });
        setIsResultConfirmed(false);
        return;
      }

      const normalizedPhoto = await normalizePhotoForScan(photo.uri);

      let photoUriForScan = normalizedPhoto.uri;

      if (cameraLayout && scannerFrameLayout) {
        const scannerFrameCrop = await cropPhotoToScannerFrame({
          photoUri: normalizedPhoto.uri,
          cameraLayout,
          scannerFrameLayout,
        });

        photoUriForScan = scannerFrameCrop.uri;
      } else if (__DEV__) {
        console.warn("[SCAN DEBUG] missing scanner frame layout", {
          cameraLayout,
          scannerFrameLayout,
        });
      }

      setCapturedPhotoUri(photoUriForScan);
      await runScan({ photoUri: photoUriForScan });
    } catch (captureError) {
      setScanStatus("not-found");
      const message = getErrorMessage(captureError);
      const reason = message
        ? `Camera capture failed: ${message}`
        : "Camera capture failed. Try again.";

      console.warn("Camera capture failed", captureError);
      setStatusMessage(reason);
      setScanResult({
        status: "failed",
        confidence: "failed",
        candidates: [],
        reason,
      });
      setIsResultConfirmed(false);
    }
  }

  async function handleRetryOcr() {
    await runScan({
      photoUri: capturedPhotoUri || undefined,
    });
  }

  async function handleCheckFields() {
    await runScan({});
  }

  async function handleSeePrice() {
    if (!canSearchCardmarket) {
      setStatusMessage("Enter a card name before searching Cardmarket.");
      return;
    }

    setStatusMessage("Checking Cardmarket page...");

    const resolvedUrl =
      canUseExactCard && detectedCard
        ? await getOpenableCardmarketUrlForCard(detectedCard, {
            printing: activePrinting,
          })
        : undefined;
    const searchUrl = buildCardmarketSearchUrl({
      name: detectedCard?.name ?? name,
    });
    const url = resolvedUrl?.url ?? searchUrl;

    if (!url) {
      setStatusMessage("No Cardmarket URL could be built.");
      return;
    }

    setLastUrl(url);
    setLastUrlMode(
      resolvedUrl?.mode === "direct"
        ? "Exact Cardmarket page ready"
        : "Name search ready",
    );
    setStatusMessage(
      resolvedUrl?.mode === "search"
        ? "Exact page returned 404. Opening name search."
        : "",
    );
    Linking.openURL(url);
  }

  function handleCameraReady() {
    setIsCameraReady(true);
    setStatusMessage("");
  }

  function handleCameraError({ message }: { message: string }) {
    setIsCameraReady(false);
    setStatusMessage(`Camera failed to start: ${message}`);
  }

  function handleConfirmResult() {
    if (!successResult) {
      return;
    }

    setIsResultConfirmed(true);
    setCollectionMessage("Card confirmed.");
    setStatusMessage("");
  }

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
      handleAddToCollection,
      handleCameraError,
      handleCameraReady,
      handleCapturePhoto,
      handleCheckFields,
      handleConfirmResult,
      handleEditedFields,
      handleRetakePhoto,
      handleRetryOcr,
      handleSeePrice,
      openEditPanel: () => setIsEditPanelOpen(true),
      setCollectionPrinting,
      setIsEditPanelOpen,
      setName,
      setNumber,
      setSetCode,
      updateCollectionQuantity,
    },
  };
}
