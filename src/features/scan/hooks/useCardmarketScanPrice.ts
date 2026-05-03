import { useEffect, useState } from 'react';

import {
  getCardmarketPriceForCard,
} from '../../cardmarket/cardmarket-prices.service';
import type { CardmarketPriceSummary } from '../../cardmarket/cardmarket.types';
import type { RiftboundCard } from '../../cards/cards.types';

export function hasPositivePrice(value?: number | null) {
  return typeof value === 'number' && value > 0;
}

export function isPriceFoilOnly(price?: CardmarketPriceSummary) {
  if (!price) {
    return false;
  }

  const hasFoilPrice =
    hasPositivePrice(price.avgFoil) ||
    hasPositivePrice(price.trendFoil) ||
    hasPositivePrice(price.lowFoil);
  const hasNormalMarketPrice =
    hasPositivePrice(price.avg) || hasPositivePrice(price.trend);

  return hasFoilPrice && !hasNormalMarketPrice;
}

export function useCardmarketScanPrice({
  canUseExactCard,
  detectedCard,
}: {
  canUseExactCard: boolean;
  detectedCard?: RiftboundCard;
}) {
  const [cardmarketPrice, setCardmarketPrice] =
    useState<CardmarketPriceSummary>();
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [priceMessage, setPriceMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    if (!detectedCard || !canUseExactCard) {
      setCardmarketPrice(undefined);
      setIsPriceLoading(false);
      setPriceMessage('');
      return () => {
        isActive = false;
      };
    }

    setIsPriceLoading(true);
    setPriceMessage('');

    getCardmarketPriceForCard(detectedCard)
      .then((price) => {
        if (!isActive) {
          return;
        }

        setCardmarketPrice(price);
        setPriceMessage(price ? '' : 'No cached price yet');
      })
      .catch(() => {
        if (isActive) {
          setCardmarketPrice(undefined);
          setPriceMessage('Price unavailable offline');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsPriceLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [canUseExactCard, detectedCard]);

  return {
    cardmarketPrice,
    isPriceLoading,
    priceMessage,
  };
}

