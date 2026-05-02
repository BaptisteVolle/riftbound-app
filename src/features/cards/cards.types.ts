export type RiftboundCard = {
  id: string;
  name: string;
  set: string;
  setCode: string;
  number: string;
  color: string;
  colors?: string[];
  cost: number;
  type: string;
  imageUrl?: string;
  externalId?: string;
  rarity?: string;
  alternateArt?: boolean;
  overnumbered?: boolean;
  signature?: boolean;
  matchConfidence?: 'exact' | 'name-only' | 'collector-only';
};

export type CardScanInput = {
  name?: string;
  setCode?: string;
  number?: string;
};
