import { useRef, useState } from "react";
import { useCameraPermissions } from "expo-camera";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";

import { Button } from "../../../components/Button";
import { ScannerOverlay } from "../../../components/ScannerOverlay";
import { ScanCameraPreview } from "../camera/ScanCameraPreview";
import type { ScanCameraHandle } from "../camera/scan-camera.types";
import { ScanCandidateStrip } from "../components/ScanCandidateStrip";
import { ScanCaptureView } from "../components/ScanCaptureView";
import { ScanFailedView } from "../components/ScanFailedView";
import { ScanLoadingView } from "../components/ScanLoadingView";
import { ScanManualEditPanel } from "../components/ScanManualEditPanel";
import { ScanResultView } from "../components/ScanResultView";
import { useScanController } from "../hooks/useScanController";
import { styles } from "./scan-screen.styles";
import { ScanDebugImages } from "../debug/ScanDebugImages";

export function ScanScreen() {
  const cameraRef = useRef<ScanCameraHandle>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraLayout, setCameraLayout] = useState<LayoutRectangle>();
  const [scannerFrameLayout, setScannerFrameLayout] =
    useState<LayoutRectangle>();
  const scan = useScanController({
    cameraRef,
    permission,
    cameraLayout,
    scannerFrameLayout,
  });
  const failedResult =
    scan.state.scanResult?.status === "failed"
      ? scan.state.scanResult
      : undefined;
  const successResult =
    scan.state.scanResult?.status === "success"
      ? scan.state.scanResult
      : undefined;

  const loadingControls = (
    <View style={styles.loadingScreen}>
      <ScanLoadingView
        step={scan.state.analysisStep}
        message={scan.state.statusMessage}
      />
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
        {failedResult && scan.state.viewMode === "failed" ? (
          <ScanFailedView
            actions={{
              onEditManually: scan.actions.openEditPanel,
              onRetakePhoto: scan.actions.handleRetakePhoto,
              onRetryOcr: scan.actions.handleRetryOcr,
            }}
            canRetryOcr={Boolean(scan.state.capturedPhotoUri)}
            result={failedResult}
          />
        ) : null}

        {successResult && scan.state.viewMode === "success" ? (
          <ScanResultView
            actions={{
              onAddToCollection: scan.actions.handleAddToCollection,
              onChangePrinting: scan.actions.setCollectionPrinting,
              onConfirmResult: scan.actions.handleConfirmResult,
              onSeePrice: scan.actions.handleSeePrice,
              onUpdateCollectionQuantity: scan.actions.updateCollectionQuantity,
            }}
            collection={{
              activePrinting: scan.state.activePrinting,
              canAddToCollection: scan.state.canAddToCollection,
              collectionMessage: scan.state.collectionMessage,
              collectionQuantity: scan.state.collectionQuantity,
              isSavingCollection: scan.state.isSavingCollection,
              requiresResultConfirmation: scan.state.requiresResultConfirmation,
              resultGuidanceMessage: scan.state.resultGuidanceMessage,
            }}
            display={{
              canSearchCardmarket: scan.state.canSearchCardmarket,
              canUseExactCard: scan.state.canUseExactCard,
              imageUri: scan.state.candidateImageUri,
              isFoilLocked: scan.state.isFoilLocked,
              lastUrlMode: scan.state.lastUrlMode,
              title: scan.state.displayedTitle,
            }}
            price={{
              cardmarketPrice: scan.state.cardmarketPrice,
              isPriceLoading: scan.state.isPriceLoading,
              priceMessage: scan.state.priceMessage,
            }}
            result={successResult}
          />
        ) : null}

        <ScanCandidateStrip
          candidates={scan.state.alternativeCandidates}
          hasDetectedCard={Boolean(scan.state.detectedCard)}
          onApplyCandidate={scan.actions.applyCandidateCard}
        />

        {scan.state.shouldShowReviewStatus ? (
          <Text style={styles.statusMessage}>{scan.state.statusMessage}</Text>
        ) : null}

        <ScanManualEditPanel
          capturedPhotoUri={scan.state.capturedPhotoUri}
          isBusy={scan.state.isBusy}
          isOpen={scan.state.isEditPanelOpen}
          name={scan.state.name}
          number={scan.state.number}
          scanStatus={scan.state.scanStatus}
          setCode={scan.state.setCode}
          onCheckFields={scan.actions.handleCheckFields}
          onNameChange={(value) => {
            scan.actions.setName(value);
            scan.actions.handleEditedFields();
          }}
          onNumberChange={(value) => {
            scan.actions.setNumber(value);
            scan.actions.handleEditedFields();
          }}
          onRetryOcr={scan.actions.handleRetryOcr}
          onSetCodeChange={(value) => {
            scan.actions.setSetCode(value);
            scan.actions.handleEditedFields();
          }}
          onToggle={() => {
            scan.actions.setIsEditPanelOpen((currentValue) => !currentValue);
          }}
        />
        <ScanDebugImages images={scan.state.scanDebugImages} />
      </ScrollView>

      <View style={styles.reviewFooter}>
        <Button
          label="NEW SCAN"
          tone="orange"
          labelStyle={styles.newScanButtonLabel}
          style={styles.newScanButton}
          onPress={scan.actions.handleRetakePhoto}
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
      {scan.state.viewMode === "capture" ? (
        <ScanCameraPreview
          ref={cameraRef}
          active
          onCameraError={scan.actions.handleCameraError}
          onCameraReady={scan.actions.handleCameraReady}
          onDetectedCardFrame={scan.actions.handleDetectedCardFrame}
          onLayout={(event) => {
            setCameraLayout(event.nativeEvent.layout);
          }}
          shouldAutoDetect={!scan.state.isBusy}
          style={styles.camera}
        />
      ) : null}
      {scan.state.viewMode === "capture" ? (
        <ScannerOverlay onFrameLayout={setScannerFrameLayout} />
      ) : null}
      <View
        style={
          scan.state.viewMode === "capture"
            ? styles.capturePanel
            : styles.reviewPanel
        }
      >
        {scan.state.viewMode === "capture" ? (
          <ScanCaptureView
            isBusy={scan.state.isBusy}
            isCameraReady={scan.state.isCameraReady}
            message={scan.state.statusMessage}
            status={scan.state.scanStatus}
            onCapturePhoto={scan.actions.handleCapturePhoto}
          />
        ) : scan.state.viewMode === "loading" ? (
          loadingControls
        ) : (
          reviewControls
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
