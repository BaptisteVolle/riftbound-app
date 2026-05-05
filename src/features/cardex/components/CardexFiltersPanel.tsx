import React from "react";
import { StyleSheet, View } from "react-native";

import { AppPanel } from "../../../components/AppPanel";
import { DropdownSelect } from "../../../components/DropdownSelect";
import { theme } from "../../../theme";
import type {
  CardexFilters,
  CardexOptionModels,
  CardexSortState,
} from "../cardex.types";
import { CardexSortDirectionControl } from "./CardexSortDirectionControl";

export function CardexFiltersPanel({
  filters,
  optionModels,
  sort,
  updateFilters,
  updateSort,
}: {
  filters: CardexFilters;
  optionModels: CardexOptionModels;
  sort: CardexSortState;
  updateFilters: (patch: Partial<CardexFilters>) => void;
  updateSort: (patch: Partial<CardexSortState>) => void;
}) {
  return (
    <AppPanel style={styles.panel}>
      <View style={styles.row}>
        <View style={styles.field}>
          <DropdownSelect
            label="Set"
            options={optionModels.setOptions}
            value={filters.setFilter}
            onChange={(setFilter) => updateFilters({ setFilter })}
          />
        </View>

        <View style={styles.field}>
          <DropdownSelect
            label="Color"
            options={optionModels.colorOptions}
            value={filters.colorFilter}
            onChange={(colorFilter) => updateFilters({ colorFilter })}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <DropdownSelect
            label="Type"
            options={optionModels.typeOptions}
            value={filters.typeFilter}
            onChange={(typeFilter) => updateFilters({ typeFilter })}
          />
        </View>

        <View style={styles.field}>
          <DropdownSelect
            label="Rarity"
            options={optionModels.rarityOptions}
            value={filters.rarityFilter}
            onChange={(rarityFilter) => updateFilters({ rarityFilter })}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <DropdownSelect
            label="Sort by"
            options={optionModels.sortOptions}
            value={sort.sortKey}
            onChange={(sortKey) => updateSort({ sortKey })}
          />
        </View>

        <View style={styles.field}>
          <CardexSortDirectionControl
            value={sort.sortDirection}
            onChange={(sortDirection) => updateSort({ sortDirection })}
          />
        </View>
      </View>
    </AppPanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.panelRaised,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  field: {
    flex: 1,
  },
});
