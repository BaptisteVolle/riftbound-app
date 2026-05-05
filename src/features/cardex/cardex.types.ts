export type CardexSortKey = "set" | "name" | "type" | "rarity" | "price";
export type CardexSortDirection = "asc" | "desc";

export type CardexRouteParams = {
  query?: string;
  ownedOnly?: string;
  setFilter?: string;
  colorFilter?: string;
  typeFilter?: string;
  rarityFilter?: string;
  sortKey?: string;
  sortDirection?: string;
};

export type CardexFilters = {
  query: string;
  ownedOnly: boolean;
  setFilter: string;
  colorFilter: string;
  typeFilter: string;
  rarityFilter: string;
};

export type CardexSortState = {
  sortKey: CardexSortKey;
  sortDirection: CardexSortDirection;
};

export type CardexOwnershipSummary = {
  normal: number;
  foil: number;
  total: number;
};

export type DropdownOption<TValue extends string = string> = {
  label: string;
  value: TValue;
};

export type CardexOptionModels = {
  setOptions: DropdownOption[];
  colorOptions: DropdownOption[];
  typeOptions: DropdownOption[];
  rarityOptions: DropdownOption[];
  sortOptions: DropdownOption<CardexSortKey>[];
};

export const CARDEX_PAGE_SIZE = 20;

export const CARDEX_SORT_OPTIONS: CardexSortKey[] = [
  "set",
  "name",
  "type",
  "rarity",
  "price",
];
