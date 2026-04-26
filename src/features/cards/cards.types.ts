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
};

export type CardScanInput = {
  name?: string;
  setCode?: string;
  number?: string;
};
