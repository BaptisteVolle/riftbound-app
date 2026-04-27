export type RiftCodexCard = {
  id: string;
  name: string;
  riftbound_id?: string;
  collector_number?: number;
  attributes?: {
    energy?: number | null;
    might?: number | null;
    power?: number | null;
  };
  classification?: {
    type?: string | null;
    rarity?: string | null;
    domain?: string[];
  };
  set?: {
    set_id?: string;
    id?: string;
    label?: string;
  };
  media?: {
    image_url?: string;
  };
  metadata?: {
    alternate_art?: boolean;
    clean_name?: string;
  };
};

export type RiftCodexCardsResponse = {
  items?: RiftCodexCard[];
};
