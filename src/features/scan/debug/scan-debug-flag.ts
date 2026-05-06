export const SCAN_DEBUG = __DEV__ && true;

export const SCAN_IMAGE_DEBUG = SCAN_DEBUG && true;
export const SCAN_OCR_DEBUG = SCAN_DEBUG && true;
export const SCAN_MATCH_DEBUG = SCAN_DEBUG && true;
export const SCAN_IMAGE_FIRST = __DEV__ && true;
export const SCAN_IMAGE_MATCH_CROP_KIND = "full-card" as const;
export const SCAN_USE_VISION_CAMERA = __DEV__ && true;
export const SCAN_AUTO_CAPTURE = __DEV__ && true;
export const SCAN_OPENCV_DEBUG = SCAN_DEBUG && true;
export const SCAN_AUTO_CAPTURE_STABLE_FRAMES = 8;
export const SCAN_AUTO_CAPTURE_COOLDOWN_MS = 2500;
export const SCAN_IMAGE_SIGNATURE_ONLY_DEBUG = __DEV__ && false;
export const SCAN_IMAGE_SIGNATURE_TARGET_CARD_ID = "";
