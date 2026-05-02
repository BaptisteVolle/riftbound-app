import { RiftboundCard } from '../cards/cards.types';
import { CardmarketPriceSummary } from '../cardmarket/cardmarket.types';

export type CollectionPrinting = 'normal' | 'foil';

export type CollectionCardSnapshot = Pick<
  RiftboundCard,
  | 'id'
  | 'externalId'
  | 'name'
  | 'set'
  | 'setCode'
  | 'number'
  | 'color'
  | 'colors'
  | 'cost'
  | 'type'
  | 'imageUrl'
  | 'rarity'
  | 'alternateArt'
  | 'overnumbered'
  | 'signature'
>;

export type CollectionEntry = {
  cardKey: string;
  card: CollectionCardSnapshot;
  normalQuantity: number;
  foilQuantity: number;
  language: string;
  condition: string;
  lastPrice?: string;
  priceUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CollectionTotals = {
  uniqueCards: number;
  totalCards: number;
  normalCards: number;
  foilCards: number;
};

export type CollectionRow = {
  entry: CollectionEntry;
  price?: CardmarketPriceSummary;
  low?: number | null;
  avg?: number | null;
  trend?: number | null;
  estimatedValue: number;
  totalQuantity: number;
};
