import { Text, View } from "react-native";

import { Button } from "../../../components/Button";
import type { CollectionPrinting } from "../../collection/collection.types";
import {
  buildScanResultViewModel,
  type ScanResultCollectionState,
  type ScanResultDisplayState,
  type ScanResultPriceState,
} from "../scan-result.view-model";
import { styles } from "../screens/scan-screen.styles";
import type { ScanAnalysisSuccess } from "../scan.types";
import { ScanCardPreview } from "./ScanCardPreview";
import { ScanCollectionControls } from "./ScanCollectionControls";
import { ScanPriceBlock } from "./ScanPriceBlock";
import { ScanPrintingSelector } from "./ScanPrintingSelector";
import { ScanResultHeader } from "./ScanResultHeader";
import React from "react";

type ScanResultActions = {
  onAddToCollection: () => void;
  onChangePrinting: (printing: CollectionPrinting) => void;
  onConfirmResult: () => void;
  onSeePrice: () => void;
  onUpdateCollectionQuantity: (delta: number) => void;
};

export function ScanResultView({
  actions,
  collection,
  display,
  price,
  result,
}: {
  actions: ScanResultActions;
  collection: ScanResultCollectionState;
  display: ScanResultDisplayState;
  price: ScanResultPriceState;
  result: ScanAnalysisSuccess;
}) {
  const viewModel = buildScanResultViewModel({
    collection,
    display,
    result,
  });
  const primaryCollectionAction =
    viewModel.primaryAction === "confirm"
      ? actions.onConfirmResult
      : actions.onAddToCollection;

  return (
    <View style={styles.candidatePanel}>
      <ScanResultHeader
        confidence={result.confidence}
        title={viewModel.title}
        subtitle={viewModel.subtitle}
      />

      <ScanCardPreview imageUri={viewModel.imageUri} />

      {viewModel.guidanceMessage ? (
        <Text style={styles.resultGuidanceText}>
          {viewModel.guidanceMessage}
        </Text>
      ) : null}

      {viewModel.canShowPrice ? (
        <ScanPriceBlock
          cardmarketPrice={price.cardmarketPrice}
          isPriceLoading={price.isPriceLoading}
          priceMessage={price.priceMessage}
          pricePrinting={collection.activePrinting}
        />
      ) : null}

      <View style={styles.controlRow}>
        {viewModel.isPrintingSelectorVisible ? (
          <View style={styles.controlColumn}>
            <ScanPrintingSelector
              activePrinting={collection.activePrinting}
              disabled={display.isFoilLocked || collection.isSavingCollection}
              label={viewModel.printingLabel}
              onChangePrinting={actions.onChangePrinting}
            />
          </View>
        ) : (
          <View style={styles.controlColumn} />
        )}

        <View style={styles.controlColumn}>
          <Button
            disabled={!display.canSearchCardmarket}
            label="OPEN CARDMARKET"
            tone="gold"
            labelStyle={styles.cardPriceButtonLabel}
            style={[styles.cardPriceButton, styles.fullWidthControl]}
            onPress={actions.onSeePrice}
          />
        </View>
      </View>

      <ScanCollectionControls
        actionDisabled={viewModel.isCollectionActionDisabled}
        actionLabel={viewModel.collectionActionLabel}
        collectionMessage={collection.collectionMessage}
        isSavingCollection={collection.isSavingCollection}
        quantity={collection.collectionQuantity}
        onPrimaryAction={primaryCollectionAction}
        onUpdateQuantity={actions.onUpdateCollectionQuantity}
      />

      {viewModel.cardmarketHint ? (
        <Text style={styles.resultGuidanceText}>
          {viewModel.cardmarketHint}
        </Text>
      ) : null}
    </View>
  );
}
