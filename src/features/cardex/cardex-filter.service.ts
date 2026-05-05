import type { RiftboundCard } from "../cards/cards.types";
import type { CardexFilters, DropdownOption } from "./cardex.types";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\brek sai\b/g, "reksai")
    .trim();
}

export function cardMatchesCardexFilters(
  card: RiftboundCard,
  filters: CardexFilters,
) {
  if (filters.setFilter !== "ALL" && card.setCode !== filters.setFilter) {
    return false;
  }

  const cardColors = card.colors?.length ? card.colors : [card.color];

  if (
    filters.colorFilter !== "ALL" &&
    !cardColors.includes(filters.colorFilter)
  ) {
    return false;
  }

  if (filters.typeFilter !== "ALL" && card.type !== filters.typeFilter) {
    return false;
  }

  const rarity = card.rarity ?? "Unknown";

  if (filters.rarityFilter !== "ALL" && rarity !== filters.rarityFilter) {
    return false;
  }

  const query = filters.query.trim();

  if (!query) {
    return true;
  }

  const haystack = normalize(
    [
      card.name,
      card.set,
      card.setCode,
      card.number,
      card.color,
      card.colors?.join(" "),
      card.rarity,
      card.type,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return haystack.includes(normalize(query));
}

export function getOptionValues(values: string[]) {
  return [
    "ALL",
    ...new Set(
      values.filter(Boolean).sort((left, right) => left.localeCompare(right)),
    ),
  ];
}

export function toDropdownOptions<TValue extends string>(
  values: readonly TValue[],
): DropdownOption<TValue>[] {
  return values.map((value) => ({
    label: value === "ALL" ? "All" : value,
    value,
  }));
}
