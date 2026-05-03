import { Image, Pressable, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import type { CardmarketPriceSummary } from '../../cardmarket/cardmarket.types';
import type { RiftboundCard } from '../../cards/cards.types';
import type { CollectionPrinting } from '../../collection/collection.types';
import { styles } from '../screens/scan-screen.styles';
import type { ScanConfidence } from '../scan.types';
import { ScanConfidenceBadge } from './ScanConfidenceBadge';
import { ScanPriceBlock } from './ScanPriceBlock';

export function ScanResultView({
  activePrinting,
  canSearchCardmarket,
  canUseExactCard,
  cardmarketPrice,
  candidateImageUri,
  collectionMessage,
  collectionQuantity,
  confidence,
  detectedCard,
  displayedTitle,
  isFoilLocked,
  isPriceLoading,
  isSavingCollection,
  lastUrlMode,
  onAddToCollection,
  onChangePrinting,
  onSeePrice,
  onUpdateCollectionQuantity,
  priceMessage,
}: {
  activePrinting: CollectionPrinting;
  canSearchCardmarket: boolean;
  canUseExactCard: boolean;
  cardmarketPrice?: CardmarketPriceSummary;
  candidateImageUri: string;
  collectionMessage: string;
  collectionQuantity: number;
  confidence?: ScanConfidence;
  detectedCard?: RiftboundCard;
  displayedTitle: string;
  isFoilLocked: boolean;
  isPriceLoading: boolean;
  isSavingCollection: boolean;
  lastUrlMode: string;
  onAddToCollection: () => void;
  onChangePrinting: (printing: CollectionPrinting) => void;
  onSeePrice: () => void;
  onUpdateCollectionQuantity: (delta: number) => void;
  priceMessage: string;
}) {
  return (
    <View style={styles.candidatePanel}>
      <Text numberOfLines={2} style={styles.resultTitle}>
        {displayedTitle || 'Edit fields below'}
      </Text>

      <View style={styles.cardImageWrap}>
        {candidateImageUri ? (
          <Image source={{ uri: candidateImageUri }} style={styles.cardImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>No image</Text>
          </View>
        )}
      </View>

      {confidence ? <ScanConfidenceBadge confidence={confidence} /> : null}

      {canUseExactCard ? (
        <ScanPriceBlock
          cardmarketPrice={cardmarketPrice}
          isPriceLoading={isPriceLoading}
          priceMessage={priceMessage}
          pricePrinting={activePrinting}
        />
      ) : null}

      <View style={styles.resultActionRow}>
        {canUseExactCard ? (
          <View style={styles.printingControl}>
            <Text style={styles.optionLabel}>
              {isFoilLocked ? 'Foil only' : 'Printing'}
            </Text>
            <View style={styles.segmentedControl}>
              <Pressable
                disabled={isFoilLocked || isSavingCollection}
                onPress={() => onChangePrinting('normal')}
                style={[
                  styles.segmentButton,
                  activePrinting === 'normal' && styles.segmentButtonActive,
                  isFoilLocked && styles.segmentButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activePrinting === 'normal' && styles.segmentTextActive,
                  ]}
                >
                  Normal
                </Text>
              </Pressable>
              <Pressable
                disabled={isFoilLocked || isSavingCollection}
                onPress={() => onChangePrinting('foil')}
                style={[
                  styles.segmentButton,
                  activePrinting === 'foil' && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activePrinting === 'foil' && styles.segmentTextActive,
                  ]}
                >
                  Foil
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <Button
          disabled={!canSearchCardmarket}
          label="OPEN CARDMARKET"
          tone="gold"
          labelStyle={styles.cardPriceButtonLabel}
          style={styles.cardPriceButton}
          onPress={onSeePrice}
        />
      </View>

      <View style={styles.collectionOptions}>
        <View style={styles.quantityControl}>
          <Text style={styles.optionLabel}>Copies</Text>
          <View style={styles.stepperRow}>
            <Button
              disabled={collectionQuantity <= 1 || isSavingCollection}
              label="-"
              tone="dark"
              style={styles.stepperButton}
              onPress={() => onUpdateCollectionQuantity(-1)}
            />
            <Text style={styles.quantityValue}>{collectionQuantity}</Text>
            <Button
              disabled={isSavingCollection}
              label="+"
              tone="dark"
              style={styles.stepperButton}
              onPress={() => onUpdateCollectionQuantity(1)}
            />
          </View>
        </View>
        <Button
          disabled={!canUseExactCard || !detectedCard || isSavingCollection}
          label={isSavingCollection ? 'ADDING...' : 'ADD TO COLLECTION'}
          tone="orange"
          labelStyle={styles.collectionAddButtonLabel}
          style={styles.collectionAddButton}
          onPress={onAddToCollection}
        />
      </View>
      {collectionMessage ? (
        <Text style={styles.collectionMessage}>{collectionMessage}</Text>
      ) : null}

      {!canUseExactCard && !confidence ? (
        <View style={[styles.confidenceBadge, styles.searchBadge]}>
          <Text style={styles.confidenceText}>
            {lastUrlMode || 'Needs confirmation'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

