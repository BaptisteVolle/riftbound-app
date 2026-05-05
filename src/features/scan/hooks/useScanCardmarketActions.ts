import { useEffect } from "react";
import { Linking } from "react-native";

import {
  buildCardmarketSearchUrl,
  buildCardmarketUrlForCard,
  getOpenableCardmarketUrlForCard,
} from "../../cards/cards.service";
import type { RiftboundCard } from "../../cards/cards.types";
import type { CollectionPrinting } from "../../collection/collection.types";
import { isFoilLockedCard } from "../scan-logic/scan-text.service";
import type { ScanAnalysisSuccess } from "../scan.types";

export function useScanCardmarketActions({
  activePrinting,
  canSearchCardmarket,
  canUseExactCard,
  collectionPrinting,
  detectedCard,
  name,
  setCanUseExactCard,
  setCollectionMessage,
  setIsResultConfirmed,
  setLastUrl,
  setLastUrlMode,
  setStatusMessage,
  successResult,
}: {
  activePrinting: CollectionPrinting;
  canSearchCardmarket: boolean;
  canUseExactCard: boolean;
  collectionPrinting: CollectionPrinting;
  detectedCard?: RiftboundCard;
  name: string;
  setCanUseExactCard: (value: boolean) => void;
  setCollectionMessage: (message: string) => void;
  setIsResultConfirmed: (value: boolean) => void;
  setLastUrl: (url: string) => void;
  setLastUrlMode: (mode: string) => void;
  setStatusMessage: (message: string) => void;
  successResult?: ScanAnalysisSuccess;
}) {
  useEffect(() => {
    if (!detectedCard || !canUseExactCard) {
      return;
    }

    const directUrl = buildCardmarketUrlForCard(detectedCard, {
      printing: activePrinting,
    });

    const fallbackUrl = buildCardmarketSearchUrl({
      name: detectedCard.name,
    });

    setLastUrl(directUrl ?? fallbackUrl ?? "");
    setLastUrlMode(
      directUrl ? "Exact Cardmarket page ready" : "Name search ready",
    );
  }, [
    activePrinting,
    canUseExactCard,
    detectedCard,
    setLastUrl,
    setLastUrlMode,
  ]);

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

  function handleConfirmResult() {
    if (!successResult?.card) {
      return;
    }

    const confirmedCard = successResult.card;
    const nextPrinting = isFoilLockedCard(confirmedCard)
      ? "foil"
      : collectionPrinting;

    const directUrl = buildCardmarketUrlForCard(confirmedCard, {
      printing: nextPrinting,
    });

    const fallbackUrl = buildCardmarketSearchUrl({
      name: confirmedCard.name,
    });

    setIsResultConfirmed(true);
    setCanUseExactCard(Boolean(directUrl));
    setLastUrl(directUrl ?? fallbackUrl ?? "");
    setLastUrlMode(
      directUrl ? "Exact Cardmarket page ready" : "Name search ready",
    );
    setCollectionMessage("Card confirmed.");
    setStatusMessage("");
  }

  return {
    handleConfirmResult,
    handleSeePrice,
  };
}
