import type { CardScanInput } from "../../cards/cards.types";
import type { ScanDebugImage } from "../debug/scan-debug.service";
import { createScanDebugImages } from "../debug/scan-debug.service";
import { SCAN_IMAGE_DEBUG } from "../debug/scan-debug-flag";
import {
  scanCardFromManualInput,
  scanCardFromPhoto,
} from "../scan-logic/scan-flow.service";
import type {
  ScanAnalysisResult,
  ScanAnalysisStep,
  ScanStatus,
} from "../scan.types";

export function useScanRunner({
  name,
  number,
  onResult,
  resetScanResult,
  setAnalysisStep,
  setScanDebugImages,
  setScanStatus,
  setStatusMessage,
  setCode,
}: {
  name: string;
  number: string;
  onResult: (result: ScanAnalysisResult) => void;
  resetScanResult: () => void;
  setAnalysisStep: (step: ScanAnalysisStep | undefined) => void;
  setScanDebugImages: (images: ScanDebugImage[]) => void;
  setScanStatus: (status: ScanStatus) => void;
  setStatusMessage: (message: string) => void;
  setCode: string;
}) {
  async function runScan({ photoUri }: { photoUri?: string }) {
    resetScanResult();
    setScanStatus("scanning");
    setAnalysisStep("reading-text");
    setStatusMessage("Checking text...");

    if (SCAN_IMAGE_DEBUG && photoUri) {
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
      ? await scanCardFromPhoto(photoUri, { onStep })
      : await scanCardFromManualInput(
          {
            name,
            setCode,
            number,
          },
          { onStep },
        );

    onResult(result);
  }

  async function handleRetryOcr(capturedPhotoUri: string) {
    await runScan({
      photoUri: capturedPhotoUri || undefined,
    });
  }

  async function handleCheckFields() {
    await runScan({});
  }

  return {
    handleCheckFields,
    handleRetryOcr,
    runScan,
  };
}
