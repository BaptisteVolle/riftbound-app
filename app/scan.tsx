import { useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "../src/components/Button";
import { ScannerOverlay } from "../src/components/ScannerOverlay";
import {
  formatCardmarketPrice,
  getCardmarketPriceForCard,
  getDisplayPrice,
} from "../src/features/cardmarket/cardmarket-prices.service";
import { CardmarketPriceSummary } from "../src/features/cardmarket/cardmarket.types";
import { RiftboundCard } from "../src/features/cards/cards.types";
import {
  buildCardmarketSearchUrl,
  buildCardmarketUrlForCard,
  getOpenableCardmarketUrlForCard,
} from "../src/features/cards/cards.service";
import { addCardToCollection } from "../src/features/collection/collection.service";
import { CollectionPrinting } from "../src/features/collection/collection.types";
import { findRiftCodexCardFromScan } from "../src/features/riftcodex/riftcodex.service";
import {
  chooseValidatedCard,
  getCollectorMatch,
  getManualScanInput,
  getStableScanCandidates,
  getVisibleAlternativeCandidates,
  hasAnyScanInput,
  isExactScanMatch,
  isFoilLockedCard,
  isSureTextMatch,
} from "../src/features/scan/scan-match.service";
import { scanCardTextFromPhoto } from "../src/features/scan/ocr.service";
import type { RarityHint } from "../src/features/scan/ocr.service";
import { styles } from "./scan.styles";

function PriceMetric({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) {
  return (
    <View style={styles.priceMetric}>
      <Text style={styles.priceMetricLabel}>{label}</Text>
      <Text style={styles.priceMetricValue}>
        {formatCardmarketPrice(value)}
      </Text>
    </View>
  );
}

function hasPositivePrice(value?: number | null) {
  return typeof value === "number" && value > 0;
}

function isPriceFoilOnly(price?: CardmarketPriceSummary) {
  if (!price) {
    return false;
  }

  const hasFoilPrice =
    hasPositivePrice(price.avgFoil) ||
    hasPositivePrice(price.trendFoil) ||
    hasPositivePrice(price.lowFoil);
  const hasNormalMarketPrice =
    hasPositivePrice(price.avg) || hasPositivePrice(price.trend);

  return hasFoilPrice && !hasNormalMarketPrice;
}

export default function ScanScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [capturedPhotoUri, setCapturedPhotoUri] = useState("");
  const [detectedCard, setDetectedCard] = useState<RiftboundCard | undefined>();
  const [scanStatus, setScanStatus] = useState<
    "idle" | "capturing" | "scanning" | "found" | "not-found"
  >("idle");
  const [lastUrl, setLastUrl] = useState("");
  const [lastUrlMode, setLastUrlMode] = useState("");
  const [canUseExactCard, setCanUseExactCard] = useState(false);
  const [likelyCandidates, setLikelyCandidates] = useState<RiftboundCard[]>([]);
  const [collectionQuantity, setCollectionQuantity] = useState(1);
  const [collectionPrinting, setCollectionPrinting] =
    useState<CollectionPrinting>("normal");
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState("");
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [cardmarketPrice, setCardmarketPrice] =
    useState<CardmarketPriceSummary>();
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [priceMessage, setPriceMessage] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);

  const isReviewingPhoto = Boolean(capturedPhotoUri);
  const canSearchCardmarket = Boolean(name.trim() || detectedCard?.name);
  const candidateImageUri = detectedCard?.imageUrl || capturedPhotoUri;
  const displayedName = detectedCard?.name ?? name;
  const displayedMeta = detectedCard
    ? `${detectedCard.setCode} ${detectedCard.number}`
    : [setCode, number].filter(Boolean).join(" ");
  const displayedTitle = [displayedName, displayedMeta].filter(Boolean).join(" | ");
  const isBusy = scanStatus === "capturing" || scanStatus === "scanning";
  const isCheckingScan = scanStatus === "scanning";
  const isFoilOnlyPrice = isPriceFoilOnly(cardmarketPrice);
  const isFoilLocked = isFoilLockedCard(detectedCard) || isFoilOnlyPrice;
  const activePrinting = isFoilLocked ? "foil" : collectionPrinting;
  const pricePrinting = activePrinting;
  const shouldShowReviewStatus = Boolean(statusMessage && scanStatus !== "found");
  const alternativeCandidates = getVisibleAlternativeCandidates(
    likelyCandidates,
    detectedCard,
  );

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "";
  }

  useEffect(() => {
    let isActive = true;

    if (!detectedCard || !canUseExactCard) {
      setCardmarketPrice(undefined);
      setIsPriceLoading(false);
      setPriceMessage("");
      return () => {
        isActive = false;
      };
    }

    setIsPriceLoading(true);
    setPriceMessage("");

    getCardmarketPriceForCard(detectedCard)
      .then((price) => {
        if (!isActive) {
          return;
        }

        setCardmarketPrice(price);
        setPriceMessage(price ? "" : "No cached price yet");
      })
      .catch(() => {
        if (isActive) {
          setCardmarketPrice(undefined);
          setPriceMessage("Price unavailable offline");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsPriceLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [canUseExactCard, detectedCard]);

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

  function resetScanResult() {
    setDetectedCard(undefined);
    setLastUrl("");
    setLastUrlMode("");
    setCanUseExactCard(false);
    setLikelyCandidates([]);
    setCollectionQuantity(1);
    setCollectionPrinting("normal");
    setCollectionMessage("");
    setIsEditPanelOpen(false);
    setStatusMessage("");
    setCardmarketPrice(undefined);
    setIsPriceLoading(false);
    setPriceMessage("");
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
    setDetectedCard(undefined);
    setCanUseExactCard(false);
    setLikelyCandidates([]);
    setCollectionMessage("");
    setLastUrl("");
    setLastUrlMode("");
    setCardmarketPrice(undefined);
    setPriceMessage("");
    setIsEditPanelOpen(true);
  }

  function applyCandidateCard(card: RiftboundCard, message = "") {
    const nextPrinting = isFoilLockedCard(card) ? "foil" : "normal";
    const directUrl = buildCardmarketUrlForCard(card, {
      printing: nextPrinting,
    });
    const fallbackUrl = buildCardmarketSearchUrl({ name: card.name });

    setCollectionQuantity(1);
    setCollectionPrinting(nextPrinting);
    setCollectionMessage("");
    setName(card.name);
    setSetCode(card.setCode);
    setNumber(card.number);
    setDetectedCard(card);
    setCanUseExactCard(Boolean(directUrl));
    setLastUrl(directUrl ?? fallbackUrl ?? "");
    setLastUrlMode(
      directUrl ? "Exact Cardmarket page ready" : "Name search ready",
    );
    setScanStatus("found");
    setIsEditPanelOpen(false);
    setStatusMessage(message);
  }

  function updateCollectionQuantity(delta: number) {
    setCollectionQuantity((currentQuantity) => {
      return Math.max(1, Math.min(99, currentQuantity + delta));
    });
  }

  async function handleAddToCollection() {
    if (!detectedCard || !canUseExactCard) {
      setStatusMessage(
        "Confirm an exact card before adding it to the collection.",
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
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.65,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setScanStatus("not-found");
        setStatusMessage("Could not capture a photo. Try again.");
        return;
      }

      setCapturedPhotoUri(photo.uri);
      await runScan({ photoUri: photo.uri });
    } catch (captureError) {
      setScanStatus("not-found");
      const message = getErrorMessage(captureError);
      console.warn("Camera capture failed", captureError);
      setStatusMessage(
        message ? `Camera capture failed: ${message}` : "Camera capture failed. Try again.",
      );
    }
  }

  async function runScan({ photoUri }: { photoUri?: string }) {
    if (!photoUri && !name.trim() && !setCode.trim() && !number.trim()) {
      setScanStatus("not-found");
      setIsEditPanelOpen(true);
      setStatusMessage(
        "Enter at least a name, set, or number before checking.",
      );
      return;
    }

    setScanStatus("scanning");
    resetScanResult();
    setStatusMessage("Checking text...");

    try {
      let scanInput = getManualScanInput(name, setCode, number);
      let rarityHint: RarityHint | undefined;

      if (photoUri) {
        const ocrResult = await scanCardTextFromPhoto(photoUri);
        scanInput = ocrResult.input;
        rarityHint = ocrResult.rarityHint;

        setName(scanInput.name ?? "");
        setSetCode(scanInput.setCode ?? "");
        setNumber(scanInput.number ?? "");
      }

      if (!hasAnyScanInput(scanInput)) {
        setScanStatus("not-found");
        setIsEditPanelOpen(true);
        setStatusMessage(
          "OCR did not find enough card text. Edit the fields or retake the photo.",
        );
        return;
      }

      const statusParts: string[] = [];
      const collectorMatch = getCollectorMatch(scanInput, photoUri);

      if (
        photoUri &&
        collectorMatch?.card &&
        scanInput.setCode &&
        scanInput.number &&
        collectorMatch.input.setCode &&
        collectorMatch.input.number &&
        (collectorMatch.input.setCode !== scanInput.setCode ||
          collectorMatch.input.number !== scanInput.number)
      ) {
        statusParts.push(
          `OCR read ${scanInput.setCode.toUpperCase()} ${scanInput.number}; using likely ${collectorMatch.input.setCode} ${collectorMatch.input.number}.`,
        );
      }

      const baseCard =
        collectorMatch?.card ?? (await findRiftCodexCardFromScan(scanInput));

      if (!baseCard) {
        const fallbackSearchUrl = buildCardmarketSearchUrl({
          name: scanInput.name,
        });
        setLikelyCandidates(getStableScanCandidates(scanInput));
        setScanStatus("not-found");
        setLastUrl(fallbackSearchUrl ?? "");
        setLastUrlMode(fallbackSearchUrl ? "Name search ready" : "");
        setIsEditPanelOpen(true);
        setStatusMessage(
          fallbackSearchUrl
            ? "No exact local match. You can search Cardmarket by name."
            : "No match yet. Edit the fields or retake the photo.",
        );
        return;
      }

      const candidates = getStableScanCandidates(scanInput, baseCard);
      setStatusMessage(
        photoUri && !isSureTextMatch(baseCard, scanInput)
          ? "Checking image..."
          : "Checking variants...",
      );
      const validatedCard = await chooseValidatedCard({
        baseCard,
        candidates,
        input: scanInput,
        photoUri,
        rarityHint,
      });
      const selectedCard = validatedCard.card;
      const isValidatedCard =
        validatedCard.isValidated ||
        selectedCard.matchConfidence === "exact" ||
        isExactScanMatch(selectedCard, scanInput);
      const nextPrinting = isFoilLockedCard(selectedCard) ? "foil" : "normal";
      const directUrl = isValidatedCard
        ? buildCardmarketUrlForCard(selectedCard, { printing: nextPrinting })
        : undefined;
      const fallbackSearchUrl = buildCardmarketSearchUrl({
        name: selectedCard.name,
      });
      const urlToUse = directUrl ?? fallbackSearchUrl ?? "";

      statusParts.push(validatedCard.reason);

      setCollectionQuantity(1);
      setCollectionPrinting(nextPrinting);
      setCollectionMessage("");
      setName(selectedCard.name);
      setSetCode(selectedCard.setCode);
      setNumber(selectedCard.number);
      setDetectedCard(selectedCard);
      setLikelyCandidates(candidates);
      setCanUseExactCard(Boolean(directUrl));
      setLastUrl(urlToUse);
      setLastUrlMode(
        directUrl ? "Exact Cardmarket page ready" : "Name search ready",
      );
      setScanStatus("found");
      setIsEditPanelOpen(false);
      setStatusMessage(statusParts.join(" "));
    } catch (scanError) {
      setScanStatus("not-found");
      setIsEditPanelOpen(true);
      const message = scanError instanceof Error ? scanError.message : "";
      setStatusMessage(
        message.includes("Native module") ||
          message.includes("Cannot find native module")
          ? "OCR needs a native dev build. Manual text search still works."
          : "OCR or RiftCodex lookup failed. Edit the fields or try another photo.",
      );
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

  const captureControls = (
    <View style={styles.captureBar}>
      <Text style={styles.captureTitle}>SCAN RIFTBOUND CARD</Text>
      <Text style={styles.captureHint}>
        Frame the whole card, keep glare low, then capture.
      </Text>
      <Button
        disabled={isBusy || !isCameraReady}
        label={
          scanStatus === "capturing"
            ? "CAPTURING..."
            : scanStatus === "scanning"
              ? "CHECKING..."
              : !isCameraReady
                ? "CAMERA WARMING UP..."
              : "CAPTURE PHOTO"
        }
        tone="orange"
        onPress={handleCapturePhoto}
      />
      {statusMessage ? (
        <Text style={styles.captureError}>{statusMessage}</Text>
      ) : null}
    </View>
  );

  const reviewControls = (
    <View style={styles.reviewLayout}>
      <ScrollView
        style={styles.reviewScroll}
        contentContainerStyle={styles.reviewContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isCheckingScan ? (
          <View style={styles.checkingPanel}>
            <ActivityIndicator color="#F2B84B" size="small" />
            <Text style={styles.checkingText}>
              {statusMessage || "Checking card..."}
            </Text>
          </View>
        ) : null}

        <View style={styles.candidatePanel}>
          <Text numberOfLines={2} style={styles.resultTitle}>
            {displayedTitle || "Edit fields below"}
          </Text>

          <View style={styles.cardImageWrap}>
            {candidateImageUri ? (
              <Image
                source={{ uri: candidateImageUri }}
                style={styles.cardImage}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>No image</Text>
              </View>
            )}
          </View>

          {canUseExactCard ? (
            <View style={styles.priceBlock}>
              {isPriceLoading ? (
                <Text style={styles.priceStatusText}>Loading prices...</Text>
              ) : priceMessage ? (
                <Text style={styles.priceStatusText}>{priceMessage}</Text>
              ) : (
                <View style={styles.priceMetricRow}>
                  <PriceMetric
                    label="Low"
                    value={getDisplayPrice(
                      cardmarketPrice,
                      "low",
                      pricePrinting,
                    )}
                  />
                  <PriceMetric
                    label="Avg"
                    value={getDisplayPrice(
                      cardmarketPrice,
                      "avg",
                      pricePrinting,
                    )}
                  />
                  <PriceMetric
                    label="Trend"
                    value={getDisplayPrice(
                      cardmarketPrice,
                      "trend",
                      pricePrinting,
                    )}
                  />
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.resultActionRow}>
            {canUseExactCard ? (
              <View style={styles.printingControl}>
                <Text style={styles.optionLabel}>
                  {isFoilLocked ? "Foil only" : "Printing"}
                </Text>
                <View style={styles.segmentedControl}>
                  <Pressable
                    disabled={isFoilLocked || isSavingCollection}
                    onPress={() => setCollectionPrinting("normal")}
                    style={[
                      styles.segmentButton,
                      activePrinting === "normal" && styles.segmentButtonActive,
                      isFoilLocked && styles.segmentButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        activePrinting === "normal" && styles.segmentTextActive,
                      ]}
                    >
                      Normal
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isFoilLocked || isSavingCollection}
                    onPress={() => setCollectionPrinting("foil")}
                    style={[
                      styles.segmentButton,
                      activePrinting === "foil" && styles.segmentButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        activePrinting === "foil" && styles.segmentTextActive,
                      ]}
                    >
                      Foil
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <Button
              disabled={!canSearchCardmarket}
              label="OPEN CARDMARKET"
              tone="gold"
              labelStyle={styles.cardPriceButtonLabel}
              style={styles.cardPriceButton}
              onPress={handleSeePrice}
            />
          </View>

          <View style={styles.collectionOptions}>
            <View style={styles.quantityControl}>
              <Text style={styles.optionLabel}>Copies</Text>
              <View style={styles.stepperRow}>
                <Button
                  disabled={collectionQuantity <= 1 || isSavingCollection}
                  label="-"
                  tone="dark"
                  style={styles.stepperButton}
                  onPress={() => updateCollectionQuantity(-1)}
                />
                <Text style={styles.quantityValue}>{collectionQuantity}</Text>
                <Button
                  disabled={isSavingCollection}
                  label="+"
                  tone="dark"
                  style={styles.stepperButton}
                  onPress={() => updateCollectionQuantity(1)}
                />
              </View>
            </View>
            <Button
              disabled={!canUseExactCard || !detectedCard || isSavingCollection}
              label={isSavingCollection ? "ADDING..." : "ADD TO COLLECTION"}
              tone="orange"
              labelStyle={styles.collectionAddButtonLabel}
              style={styles.collectionAddButton}
              onPress={handleAddToCollection}
            />
          </View>
          {collectionMessage ? (
            <Text style={styles.collectionMessage}>{collectionMessage}</Text>
          ) : null}

          {!canUseExactCard ? (
            <View style={[styles.confidenceBadge, styles.searchBadge]}>
              <Text style={styles.confidenceText}>
                {lastUrlMode || "Needs confirmation"}
              </Text>
            </View>
          ) : null}
        </View>

        {alternativeCandidates.length > 0 ? (
          <View style={styles.candidateStrip}>
            <View style={styles.candidateStripHeader}>
              <Text style={styles.candidateStripTitle}>
                {detectedCard ? "Other variants" : "Possible matches"}
              </Text>
              <Text style={styles.candidateStripHint}>Tap to switch</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.candidateStripList}
            >
              {alternativeCandidates.map((candidate) => {
                return (
                  <Pressable
                    key={candidate.id}
                    onPress={() => {
                      applyCandidateCard(candidate);
                    }}
                    style={styles.candidateTile}
                  >
                    {candidate.imageUrl ? (
                      <Image
                        source={{ uri: candidate.imageUrl }}
                        style={styles.candidateTileImage}
                      />
                    ) : (
                      <View style={styles.candidateTileImagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>
                          No image
                        </Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.candidateTileName}>
                      {candidate.name}
                    </Text>
                    <Text style={styles.candidateTileMeta}>
                      {candidate.setCode} {candidate.number}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {shouldShowReviewStatus ? (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        ) : null}

        <View style={styles.editDropdownPanel}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setIsEditPanelOpen((currentValue) => !currentValue);
            }}
            style={styles.editToggle}
          >
            <Text style={styles.editToggleText}>
              Not right? Edit and check again
            </Text>
            <Text style={styles.editToggleIcon}>
              {isEditPanelOpen ? "-" : "+"}
            </Text>
          </Pressable>

          {isEditPanelOpen ? (
            <View style={styles.inlineEditPanel}>
              <TextInput
                autoCapitalize="words"
                blurOnSubmit
                onChangeText={(value) => {
                  setName(value);
                  handleEditedFields();
                }}
                placeholder="Card name"
                placeholderTextColor="#667085"
                returnKeyType="done"
                style={styles.input}
                value={name}
              />
              <View style={styles.row}>
                <TextInput
                  autoCapitalize="characters"
                  blurOnSubmit
                  maxLength={6}
                  onChangeText={(value) => {
                    setSetCode(value);
                    handleEditedFields();
                  }}
                  placeholder="Set"
                  placeholderTextColor="#667085"
                  returnKeyType="done"
                  style={[styles.input, styles.compactInput]}
                  value={setCode}
                />
                <TextInput
                  blurOnSubmit
                  maxLength={8}
                  onChangeText={(value) => {
                    setNumber(value);
                    handleEditedFields();
                  }}
                  placeholder="No."
                  placeholderTextColor="#667085"
                  returnKeyType="done"
                  style={[styles.input, styles.compactInput]}
                  value={number}
                />
              </View>
              <View style={styles.row}>
                <Button
                  disabled={isBusy}
                  label={
                    scanStatus === "scanning" ? "CHECKING..." : "CHECK FIELDS"
                  }
                  tone="gold"
                  style={styles.actionButton}
                  onPress={handleCheckFields}
                />
                <Button
                  disabled={isBusy || !capturedPhotoUri}
                  label="RETRY SCAN"
                  tone="blue"
                  style={styles.actionButton}
                  onPress={handleRetryOcr}
                />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.reviewFooter}>
        <Button
          label="NEW SCAN"
          tone="orange"
          labelStyle={styles.newScanButtonLabel}
          style={styles.newScanButton}
          onPress={handleRetakePhoto}
        />
      </View>
    </View>
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          Camera access is needed to scan cards.
        </Text>
        <Button label="ALLOW CAMERA" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {!isReviewingPhoto ? (
        <CameraView
          ref={cameraRef}
          active
          facing="back"
          onCameraReady={() => {
            setIsCameraReady(true);
            setStatusMessage("");
          }}
          onMountError={({ message }) => {
            setIsCameraReady(false);
            setStatusMessage(`Camera failed to start: ${message}`);
          }}
          style={styles.camera}
        />
      ) : null}
      {!isReviewingPhoto ? <ScannerOverlay /> : null}
      <View style={isReviewingPhoto ? styles.reviewPanel : styles.capturePanel}>
        {isReviewingPhoto ? reviewControls : captureControls}
      </View>
    </KeyboardAvoidingView>
  );
}
