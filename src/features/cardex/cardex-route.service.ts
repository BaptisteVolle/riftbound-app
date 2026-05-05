import type {
  CardexFilters,
  CardexRouteParams,
  CardexSortDirection,
  CardexSortKey,
  CardexSortState,
} from "./cardex.types";

export function getCardexFiltersFromParams(
  params: CardexRouteParams,
): CardexFilters {
  return {
    query: typeof params.query === "string" ? params.query : "",
    ownedOnly: params.ownedOnly === "true",
    setFilter: typeof params.setFilter === "string" ? params.setFilter : "ALL",
    colorFilter:
      typeof params.colorFilter === "string" ? params.colorFilter : "ALL",
    typeFilter:
      typeof params.typeFilter === "string" ? params.typeFilter : "ALL",
    rarityFilter:
      typeof params.rarityFilter === "string" ? params.rarityFilter : "ALL",
  };
}

export function getCardexSortFromParams(
  params: CardexRouteParams,
): CardexSortState {
  return {
    sortKey: isCardexSortKey(params.sortKey) ? params.sortKey : "set",
    sortDirection: isCardexSortDirection(params.sortDirection)
      ? params.sortDirection
      : "asc",
  };
}

export function toCardexRouteParams(
  filters: CardexFilters,
  sort: CardexSortState,
) {
  return {
    query: filters.query,
    ownedOnly: filters.ownedOnly ? "true" : "",
    setFilter: filters.setFilter,
    colorFilter: filters.colorFilter,
    typeFilter: filters.typeFilter,
    rarityFilter: filters.rarityFilter,
    sortKey: sort.sortKey,
    sortDirection: sort.sortDirection,
  };
}

function isCardexSortKey(value: unknown): value is CardexSortKey {
  return (
    value === "set" ||
    value === "name" ||
    value === "type" ||
    value === "rarity" ||
    value === "price"
  );
}

function isCardexSortDirection(value: unknown): value is CardexSortDirection {
  return value === "asc" || value === "desc";
}
