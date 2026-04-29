import { RiftboundCard } from '../cards/cards.types';

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
