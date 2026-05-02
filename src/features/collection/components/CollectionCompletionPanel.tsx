import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPanel } from '../../../components/AppPanel';
import { CardSymbolIcon } from '../../../components/CardSymbolIcon';
import { theme } from '../../../theme';
import {
  CollectionCompletionGroup,
  CollectionCompletionStats,
} from '../collection-stats.service';

type CollectionCompletionPanelProps = {
  stats: CollectionCompletionStats;
  sections?: Array<'sets' | 'rarities' | 'colors'>;
  collapsedByDefault?: boolean;
};

export function CollectionCompletionPanel({
  stats,
  sections = ['sets', 'rarities', 'colors'],
  collapsedByDefault = false,
}: CollectionCompletionPanelProps) {
  return (
    <View style={styles.container}>
      {sections.includes('sets') ? (
        <CompletionSection
          collapsedByDefault={collapsedByDefault}
          groups={stats.sets}
          title="Sets"
        />
      ) : null}
      {sections.includes('rarities') ? (
        <CompletionSection
          collapsedByDefault={collapsedByDefault}
          groups={stats.rarities}
          iconKind="rarity"
          title="Rarity"
        />
      ) : null}
      {sections.includes('colors') ? (
        <CompletionSection
          collapsedByDefault={collapsedByDefault}
          groups={stats.colors}
          iconKind="color"
          title="Color"
        />
      ) : null}
    </View>
  );
}

function CompletionSection({
  collapsedByDefault,
  groups,
  iconKind,
  title,
}: {
  collapsedByDefault: boolean;
  groups: CollectionCompletionGroup[];
  iconKind?: 'rarity' | 'color';
  title: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(collapsedByDefault);
  const owned = groups.reduce((sum, group) => sum + group.owned, 0);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const percent = total > 0 ? (owned / total) * 100 : 0;

  return (
    <AppPanel style={[styles.panel, isCollapsed && styles.panelCollapsed]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsCollapsed((current) => !current)}
        style={styles.header}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.headerCount}>
            {owned} / {total}
          </Text>
          <Text style={styles.headerPercent}>{percent.toFixed(1)}%</Text>
          <Text style={styles.headerChevron}>{isCollapsed ? '+' : '-'}</Text>
        </View>
      </Pressable>
      {isCollapsed
        ? null
        : groups.map((group) => (
            <CompletionRow group={group} iconKind={iconKind} key={group.key} />
          ))}
    </AppPanel>
  );
}

function CompletionRow({
  group,
  iconKind,
}: {
  group: CollectionCompletionGroup;
  iconKind?: 'rarity' | 'color';
}) {
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        {iconKind ? <CardSymbolIcon kind={iconKind} size={18} value={group.key} /> : null}
        <Text numberOfLines={1} style={styles.label}>
          {group.label}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, group.percent)}%` }]} />
      </View>
      <Text style={styles.count}>
        {group.owned} / {group.total}
      </Text>
      <Text style={styles.percent}>{group.percent.toFixed(1)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  panel: {
    gap: 10,
  },
  panelCollapsed: {
    paddingVertical: 10,
  },
  header: {
    minHeight: 24,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  headerMeta: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    color: theme.colors.textFaint,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerCount: {
    color: theme.colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  headerPercent: {
    minWidth: 46,
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  headerChevron: {
    width: 18,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  row: {
    minHeight: 31,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  labelWrap: {
    width: 138,
    minWidth: 0,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.textSoft,
    fontSize: 14,
    fontWeight: '800',
  },
  barTrack: {
    flex: 1,
    height: 5,
    minWidth: 42,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: theme.colors.panelRaised,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.gold,
  },
  count: {
    width: 58,
    color: theme.colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  percent: {
    width: 48,
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
});
