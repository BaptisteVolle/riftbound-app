import { useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '../../../components/Button';
import { ScannerOverlay } from '../../../components/ScannerOverlay';
import { ScanCandidateStrip } from '../components/ScanCandidateStrip';
import { ScanCaptureView } from '../components/ScanCaptureView';
import { ScanFailedView } from '../components/ScanFailedView';
import { ScanLoadingView } from '../components/ScanLoadingView';
import { ScanManualEditPanel } from '../components/ScanManualEditPanel';
import { ScanResultView } from '../components/ScanResultView';
import { useScanController } from '../hooks/useScanController';
import { styles } from './scan-screen.styles';

export function ScanScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scan = useScanController({ cameraRef, permission });
  const failedResult =
    scan.state.scanResult?.status === 'failed'
      ? scan.state.scanResult
      : undefined;
  const successResult =
    scan.state.scanResult?.status === 'success'
      ? scan.state.scanResult
      : undefined;

  const reviewControls = (
    <View style={styles.reviewLayout}>
      <ScrollView
        style={styles.reviewScroll}
        contentContainerStyle={styles.reviewContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {scan.state.isCheckingScan ? (
          <ScanLoadingView
            step={scan.state.analysisStep}
            message={scan.state.statusMessage}
          />
        ) : null}

        {failedResult && !scan.state.isCheckingScan ? (
          <ScanFailedView
            canRetryOcr={Boolean(scan.state.capturedPhotoUri)}
            result={failedResult}
            onEditManually={scan.actions.openEditPanel}
            onRetakePhoto={scan.actions.handleRetakePhoto}
            onRetryOcr={scan.actions.handleRetryOcr}
          />
        ) : null}

        <ScanResultView
          activePrinting={scan.state.activePrinting}
          canSearchCardmarket={scan.state.canSearchCardmarket}
          canUseExactCard={scan.state.canUseExactCard}
          cardmarketPrice={scan.state.cardmarketPrice}
          candidateImageUri={scan.state.candidateImageUri}
          collectionMessage={scan.state.collectionMessage}
          collectionQuantity={scan.state.collectionQuantity}
          confidence={successResult?.confidence}
          detectedCard={scan.state.detectedCard}
          displayedTitle={scan.state.displayedTitle}
          isFoilLocked={scan.state.isFoilLocked}
          isPriceLoading={scan.state.isPriceLoading}
          isSavingCollection={scan.state.isSavingCollection}
          lastUrlMode={scan.state.lastUrlMode}
          priceMessage={scan.state.priceMessage}
          onAddToCollection={scan.actions.handleAddToCollection}
          onChangePrinting={scan.actions.setCollectionPrinting}
          onSeePrice={scan.actions.handleSeePrice}
          onUpdateCollectionQuantity={scan.actions.updateCollectionQuantity}
        />

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {!scan.state.isReviewingPhoto ? (
        <CameraView
          ref={cameraRef}
          active
          facing="back"
          onCameraReady={scan.actions.handleCameraReady}
          onMountError={scan.actions.handleCameraError}
          style={styles.camera}
        />
      ) : null}
      {!scan.state.isReviewingPhoto ? <ScannerOverlay /> : null}
      <View
        style={
          scan.state.isReviewingPhoto ? styles.reviewPanel : styles.capturePanel
        }
      >
        {scan.state.isReviewingPhoto ? (
          reviewControls
        ) : (
          <ScanCaptureView
            isBusy={scan.state.isBusy}
            isCameraReady={scan.state.isCameraReady}
            message={scan.state.statusMessage}
            status={scan.state.scanStatus}
            onCapturePhoto={scan.actions.handleCapturePhoto}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

