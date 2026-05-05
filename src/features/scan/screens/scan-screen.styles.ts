import { StyleSheet } from "react-native";

const colors = {
  background: "#071527",
  reviewBackground: "#081E34",
  panel: "#092A4C",
  panelAlt: "#0B355F",
  panelLight: "#123F6D",
  cream: "#F8F0DC",
  gold: "#F2B84B",
  orange: "#E66A2C",
  green: "#2E8B57",

  creamBorderSoft: "rgba(248, 240, 220, 0.35)",
  creamBorder: "rgba(248, 240, 220, 0.65)",
  capturePanel: "rgba(9, 42, 76, 0.94)",
  reviewFooter: "rgba(8, 30, 52, 0.98)",
  darkOverlay: "rgba(7, 21, 39, 0.36)",
};

const cardAspectRatio = 0.716;

export const styles = StyleSheet.create({
  // ---------------------------------------------------------------------------
  // Screen layout
  // ---------------------------------------------------------------------------
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    flex: 1,
  },
  centered: {
    flex: 1,
    gap: 18,
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  message: {
    color: colors.cream,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  // ---------------------------------------------------------------------------
  // Capture mode
  // ---------------------------------------------------------------------------
  capturePanel: {
    position: "absolute",
    right: 18,
    bottom: 24,
    left: 18,
  },
  captureBar: {
    gap: 10,
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.capturePanel,
  },
  captureTitle: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  captureHint: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  captureError: {
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.orange,
    color: colors.cream,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  // ---------------------------------------------------------------------------
  // Review layout
  // ---------------------------------------------------------------------------
  reviewPanel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.reviewBackground,
    overflow: "hidden",
  },
  reviewLayout: {
    flex: 1,
  },
  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    gap: 10,
    padding: 12,
    paddingTop: 42,
  },
  reviewFooter: {
    borderTopWidth: 2,
    borderTopColor: colors.creamBorderSoft,
    padding: 14,
    paddingTop: 12,
    backgroundColor: colors.reviewFooter,
  },
  newScanButton: {
    width: "100%",
    minHeight: 60,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  newScanButtonLabel: {
    fontSize: 20,
    letterSpacing: 0,
  },

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: colors.reviewBackground,
  },
  scanLoadingPanel: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    minHeight: 112,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 14,
    padding: 18,
    backgroundColor: colors.panel,
  },
  scanLoadingText: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  // ---------------------------------------------------------------------------
  // Result panel
  // ---------------------------------------------------------------------------
  candidatePanel: {
    gap: 9,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 14,
    padding: 10,
    backgroundColor: colors.panelLight,
  },
  resultHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  resultTitleBlock: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  resultTitleInHeader: {
    textAlign: "left",
  },
  resultSubtitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
    textAlign: "left",
  },
  resultGuidanceText: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  // ---------------------------------------------------------------------------
  // Card preview
  // ---------------------------------------------------------------------------
  cardImageWrap: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  cardImage: {
    width: "78%",
    maxWidth: 300,
    aspectRatio: cardAspectRatio,
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  cardImageBattlefield: {
    transform: [{ rotate: "90deg" }],
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    width: "78%",
    maxWidth: 300,
    aspectRatio: cardAspectRatio,
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  imagePlaceholderText: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Confidence badge
  // ---------------------------------------------------------------------------
  confidenceBadge: {
    alignSelf: "flex-start",
    flexShrink: 0,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  searchBadge: {
    backgroundColor: colors.orange,
  },
  confidenceBadgeExact: {
    backgroundColor: colors.green,
  },
  confidenceBadgeLikely: {
    backgroundColor: colors.gold,
  },
  confidenceBadgeUncertain: {
    backgroundColor: colors.orange,
  },
  confidenceText: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Price block
  // ---------------------------------------------------------------------------
  priceBlock: {
    alignSelf: "stretch",
    gap: 6,
    marginTop: 2,
    minHeight: 58,
    justifyContent: "center",
  },
  priceMetricRow: {
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
  },
  priceMetric: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: colors.darkOverlay,
  },
  priceMetricLabel: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  priceMetricValue: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  priceStatusText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: "800",
    minHeight: 52,
    textAlignVertical: "center",
    textAlign: "center",
  },
  cardPriceButton: {
    width: "100%",
    minHeight: 45,
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },

  cardPriceButtonLabel: {
    fontSize: 13,
    lineHeight: 16,
  },

  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    minHeight: 45,
  },

  // ---------------------------------------------------------------------------
  // Shared controls
  // ---------------------------------------------------------------------------
  controlRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  controlLabel: {
    minHeight: 13,
    color: colors.cream,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  controlColumn: {
    flex: 1,
    gap: 6,
  },
  fullWidthControl: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.cream,
    color: colors.background,
    fontSize: 16,
    fontWeight: "800",
  },
  compactInput: {
    flex: 1,
  },

  // ---------------------------------------------------------------------------
  // Printing selector
  // ---------------------------------------------------------------------------
  printingControl: {
    width: "100%",
    gap: 6,
  },
  optionLabel: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  segmentedControl: {
    flexDirection: "row",
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 8,
    minHeight: 45,
    overflow: "hidden",
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    backgroundColor: colors.panelLight,
  },
  segmentButtonActive: {
    backgroundColor: colors.gold,
  },
  segmentButtonDisabled: {
    opacity: 0.55,
  },
  segmentText: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 13,
    textAlign: "center",
  },
  segmentTextActive: {
    color: colors.background,
  },

  // ---------------------------------------------------------------------------
  // Collection controls
  // ---------------------------------------------------------------------------

  stepperButton: {
    borderRadius: 8,
    flex: 1,
    minWidth: 42,
    minHeight: 45,
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  quantityValue: {
    minWidth: 26,
    color: colors.cream,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  collectionAddButton: {
    width: "100%",
    minHeight: 45,
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  collectionAddButtonLabel: {
    fontSize: 13,
    lineHeight: 16,
  },
  collectionMessage: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  // ---------------------------------------------------------------------------
  // Candidate strip
  // ---------------------------------------------------------------------------
  candidateStrip: {
    gap: 7,
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 14,
    padding: 8,
    backgroundColor: colors.panel,
  },
  candidateStripHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  candidateStripTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
  },
  candidateStripHint: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  candidateStripList: {
    gap: 10,
    paddingRight: 2,
  },
  candidateTile: {
    width: 84,
    gap: 4,
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 12,
    padding: 6,
    backgroundColor: colors.panelLight,
  },
  candidateTileImage: {
    width: "100%",
    aspectRatio: cardAspectRatio,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  candidateTileImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    aspectRatio: cardAspectRatio,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  candidateTileName: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  candidateTileMeta: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },

  // ---------------------------------------------------------------------------
  // Manual edit panel
  // ---------------------------------------------------------------------------
  editDropdownPanel: {
    gap: 10,
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 14,
    padding: 10,
    backgroundColor: colors.panel,
  },
  editToggle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editToggleText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: "900",
  },
  editToggleIcon: {
    minWidth: 26,
    color: colors.gold,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 24,
    textAlign: "center",
  },
  inlineEditPanel: {
    gap: 9,
  },

  // ---------------------------------------------------------------------------
  // Failed state
  // ---------------------------------------------------------------------------
  failedPanel: {
    gap: 10,
    borderWidth: 2,
    borderColor: colors.orange,
    borderRadius: 14,
    padding: 10,
    backgroundColor: colors.panel,
  },
  failedTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  failedMessage: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  failedActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  failedActionButton: {
    flex: 1,
  },

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------
  statusMessage: {
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.panelAlt,
    color: colors.cream,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
});
