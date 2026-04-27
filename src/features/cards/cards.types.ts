export type RiftboundCard = {
  id: string;
  name: string;
  set: string;
  setCode: string;
  number: string;
  color: string;
  cost: number;
  type: string;
  cardmarketPath?: string;
  imageUrl?: string;
  externalId?: string;
  rarity?: string;
  alternateArt?: boolean;
  overnumbered?: boolean;
  signature?: boolean;
};

export type CardScanInput = {
  name?: string;
  setCode?: string;
  number?: string;
};
