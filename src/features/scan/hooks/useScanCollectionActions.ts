import { addCardToCollection } from "../../collection/collection.service";
import type { CollectionPrinting } from "../../collection/collection.types";
import type { RiftboundCard } from "../../cards/cards.types";
import type { Dispatch, SetStateAction } from "react";

export function useScanCollectionActions({
  activePrinting,
  canAddToCollection,
  collectionQuantity,
  detectedCard,
  requiresResultConfirmation,
  setCollectionMessage,
  setCollectionQuantity,
  setIsSavingCollection,
  setStatusMessage,
}: {
  activePrinting: CollectionPrinting;
  canAddToCollection: boolean;
  collectionQuantity: number;
  detectedCard?: RiftboundCard;
  requiresResultConfirmation: boolean;
  setCollectionMessage: (message: string) => void;
  setCollectionQuantity: Dispatch<SetStateAction<number>>;
  setIsSavingCollection: (value: boolean) => void;
  setStatusMessage: (message: string) => void;
}) {
  function updateCollectionQuantity(delta: number) {
    setCollectionQuantity((currentQuantity) => {
      return Math.max(1, Math.min(99, currentQuantity + delta));
    });
  }

  async function handleAddToCollection() {
    if (!detectedCard || !canAddToCollection) {
      setStatusMessage(
        requiresResultConfirmation
          ? "Confirm this card before adding it to the collection."
          : "Confirm a card before adding it to the collection.",
      );
      return;
    }

    setIsSavingCollection(true);
    setCollectionMessage("");

    try {
      const entry = await addCardToCollection(
        detectedCard,
        activePrinting,
        collectionQuantity,
      );

      const total =
        activePrinting === "foil" ? entry.foilQuantity : entry.normalQuantity;

      setCollectionMessage(
        `Added ${collectionQuantity} ${activePrinting} ${
          collectionQuantity === 1 ? "copy" : "copies"
        }. Total: ${total}.`,
      );

      setStatusMessage("");
    } catch {
      setStatusMessage("Could not add this card to the collection.");
    } finally {
      setIsSavingCollection(false);
    }
  }

  return {
    handleAddToCollection,
    updateCollectionQuantity,
  };
}
