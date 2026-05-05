import type { CardmarketPriceSummary } from "../cardmarket/cardmarket.types";
import type { CollectionPrinting } from "../collection/collection.types";
import type { ScanAnalysisSuccess } from "./scan.types";

export type ScanResultDisplayState = {
  canSearchCardmarket: boolean;
  canUseExactCard: boolean;
  imageUri: string;
  isFoilLocked: boolean;
  lastUrlMode: string;
  title: string;
};

export type ScanResultPriceState = {
  cardmarketPrice?: CardmarketPriceSummary;
  isPriceLoading: boolean;
  priceMessage: string;
};

export type ScanResultCollectionState = {
  activePrinting: CollectionPrinting;
  canAddToCollection: boolean;
  collectionMessage: string;
  collectionQuantity: number;
  isSavingCollection: boolean;
  requiresResultConfirmation: boolean;
  resultGuidanceMessage: string;
};

export type ScanResultPrimaryAction = "add" | "confirm";

export type ScanResultViewModel = {
  cardmarketHint: string;
  collectionActionLabel: string;
  guidanceMessage: string;
  imageUri: string;
  isCollectionActionDisabled: boolean;
  isPrintingSelectorVisible: boolean;
  canShowPrice: boolean;
  primaryAction: ScanResultPrimaryAction;
  printingLabel: string;
  title: string;
  subtitle?: string;
};

export function buildScanResultViewModel({
  collection,
  display,
  result,
}: {
  collection: ScanResultCollectionState;
  display: ScanResultDisplayState;
  result: ScanAnalysisSuccess;
}): ScanResultViewModel {
  const primaryAction = collection.requiresResultConfirmation
    ? "confirm"
    : "add";
  const collectionActionLabel = collection.requiresResultConfirmation
    ? "CONFIRM THIS CARD"
    : collection.isSavingCollection
      ? "ADDING..."
      : "ADD TO COLLECTION";

  return {
    cardmarketHint: display.canUseExactCard
      ? ""
      : display.lastUrlMode || "Needs confirmation",
    collectionActionLabel,
    guidanceMessage: collection.resultGuidanceMessage,
    imageUri: display.imageUri,
    isCollectionActionDisabled:
      collection.isSavingCollection ||
      (!collection.canAddToCollection &&
        !collection.requiresResultConfirmation),
    isPrintingSelectorVisible: Boolean(result.card),
    canShowPrice: display.canUseExactCard,
    primaryAction,
    printingLabel: display.isFoilLocked ? "Foil only" : "Printing",
    title: result.card.name || display.title || "Edit fields below",
    subtitle: `${result.card.setCode} ${result.card.number}`,
  };
}
