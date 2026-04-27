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
};

export type CardScanInput = {
  name?: string;
  setCode?: string;
  number?: string;
};
