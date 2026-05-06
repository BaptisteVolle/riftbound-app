export type ScanCapturedPhoto = {
  uri: string;
};

export type ScanCameraHandle = {
  takeScanPhoto: () => Promise<ScanCapturedPhoto | undefined>;
};
