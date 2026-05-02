export type CardmarketProductMapping = {
  riftboundId?: string;
  setCode: string;
  number: string;
  name: string;
  color?: string;
  colors?: string[];
  type?: string;
  rarity?: string;
  imageUrl?: string;
  cardmarketPath: string;
  notes?: string;
};

export type CardmarketProductCatalogItem = {
  idProduct: number;
  name: string;
  idCategory: number;
  categoryName: string;
  idExpansion: number;
  idMetacard: number;
  dateAdded: string;
};

export type CardmarketProductCatalog = {
  version: number;
  createdAt: string;
  products: CardmarketProductCatalogItem[];
};

export type CardmarketPriceGuideItem = {
  idProduct: number;
  idCategory: number;
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  "avg-foil": number | null;
  "low-foil": number | null;
  "trend-foil": number | null;
  "avg1-foil": number | null;
  "avg7-foil": number | null;
  "avg30-foil": number | null;
};

export type CardmarketPriceGuide = {
  version: number;
  createdAt: string;
  priceGuides: CardmarketPriceGuideItem[];
};

export type CardmarketPriceSummary = {
  idProduct: number;
  updatedAt: string;
  low: number | null;
  trend: number | null;
  avg: number | null;
  lowFoil: number | null;
  trendFoil: number | null;
  avgFoil: number | null;
};
