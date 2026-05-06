import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from "react";
import {
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CameraView } from "expo-camera";
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useRunOnJS } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";

import {
  SCAN_OPENCV_DEBUG,
  SCAN_USE_VISION_CAMERA,
} from "../debug/scan-debug-flag";
import { detectCardInFrame } from "../scan-logic/card-detection.service";
import type { CardDetectionResult } from "../scan-logic/card-detection.types";
import type { ScanCameraHandle } from "./scan-camera.types";

let resizeErrorDebugCount = 0;

type ScanCameraPreviewProps = {
  active: boolean;
  onCameraError: (error: { message: string }) => void;
  onCameraReady: () => void;
  onDetectedCardFrame?: (region: CardDetectionResult | undefined) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  shouldAutoDetect: boolean;
  style: StyleProp<ViewStyle>;
};

function toFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function ExpoScanCameraPreview(
  {
    active,
    onCameraError,
    onCameraReady,
    onLayout,
    style,
  }: ScanCameraPreviewProps,
  ref: Ref<ScanCameraHandle>,
) {
  const cameraRef = useRef<CameraView>(null);

  useImperativeHandle(ref, () => ({
    async takeScanPhoto() {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.65,
        skipProcessing: false,
      });

      return photo?.uri ? { uri: photo.uri } : undefined;
    },
  }));

  return (
    <CameraView
      ref={cameraRef}
      active={active}
      facing="back"
      onCameraReady={onCameraReady}
      onLayout={onLayout}
      onMountError={onCameraError}
      style={style}
    />
  );
}

function VisionScanCameraPreview(
  {
    active,
    onCameraError,
    onCameraReady,
    onDetectedCardFrame,
    onLayout,
    shouldAutoDetect,
    style,
  }: ScanCameraPreviewProps,
  ref: Ref<ScanCameraHandle>,
) {
  const cameraRef = useRef<Camera>(null);
  const frameDebugCountRef = useRef(0);
  const device = useCameraDevice("back");
  const { resize } = useResizePlugin();
  const reportDetectedCardFrame = useRunOnJS(
    (region: CardDetectionResult | undefined) => {
      onDetectedCardFrame?.(region);
    },
    [onDetectedCardFrame],
  );
  const reportFrameDebug = useRunOnJS(
    (frameSize: { width: number; height: number; pixelFormat: string }) => {
      if (SCAN_OPENCV_DEBUG && frameDebugCountRef.current < 12) {
        frameDebugCountRef.current += 1;
        console.log("[SCAN DETECTION] frame processor", frameSize);
      }
    },
    [],
  );
  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      if (!shouldAutoDetect) {
        return;
      }

      runAtTargetFps(5, () => {
        "worklet";
        try {
          const detectionWidth = 320;
          const detectionHeight = Math.max(
            1,
            Math.round((frame.height / frame.width) * detectionWidth),
          );
          const resized = resize(frame, {
            scale: {
              width: detectionWidth,
              height: detectionHeight,
            },
            pixelFormat: "bgr",
            dataType: "uint8",
          });

          reportFrameDebug({
            width: frame.width,
            height: frame.height,
            pixelFormat: frame.pixelFormat,
          });
          reportDetectedCardFrame(
            detectCardInFrame({
              channels: 3,
              data: resized,
              height: detectionHeight,
              sourceFrame: {
                height: frame.height,
                pixelFormat: frame.pixelFormat,
                width: frame.width,
              },
              width: detectionWidth,
            }),
          );
        } catch (error) {
          if (resizeErrorDebugCount < 8) {
            resizeErrorDebugCount += 1;
            console.log("[SCAN DETECTION] resize skipped frame", {
              error:
                error instanceof Error
                  ? error.message
                  : typeof error === "string"
                    ? error
                    : "unknown",
              height: frame.height,
              pixelFormat: frame.pixelFormat,
              width: frame.width,
            });
          }
          reportDetectedCardFrame(undefined);
        }
      });
    },
    [reportDetectedCardFrame, reportFrameDebug, resize, shouldAutoDetect],
  );

  useImperativeHandle(ref, () => ({
    async takeScanPhoto() {
      const photo = await cameraRef.current?.takePhoto({
        flash: "off",
      });

      return photo?.path ? { uri: toFileUri(photo.path) } : undefined;
    },
  }));

  const handleError = useMemo(
    () => (error: { message: string }) => {
      onCameraError({ message: error.message });
    },
    [onCameraError],
  );

  if (!device) {
    return (
      <View onLayout={onLayout} style={style}>
        <Text>Loading camera...</Text>
      </View>
    );
  }

  return (
    <Camera
      ref={cameraRef}
      device={device}
      isActive={active}
      onError={handleError}
      onInitialized={onCameraReady}
      onLayout={onLayout}
      enableBufferCompression={false}
      photo
      pixelFormat="yuv"
      frameProcessor={shouldAutoDetect ? frameProcessor : undefined}
      style={style}
    />
  );
}

const ForwardedExpoScanCameraPreview = forwardRef(ExpoScanCameraPreview);
const ForwardedVisionScanCameraPreview = forwardRef(VisionScanCameraPreview);

export const ScanCameraPreview = forwardRef<
  ScanCameraHandle,
  ScanCameraPreviewProps
>(function ScanCameraPreview(props, ref) {
  if (!SCAN_USE_VISION_CAMERA) {
    return <ForwardedExpoScanCameraPreview ref={ref} {...props} />;
  }

  return <ForwardedVisionScanCameraPreview ref={ref} {...props} />;
});
