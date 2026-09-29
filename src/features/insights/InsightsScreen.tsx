import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '../../domain/money';
import { RANGE_OPTIONS } from '../../lib/ranges';
import { useApp } from '../../state/store';
import { CategoryBars } from '../../ui/charts';
import { Card, EmptyState, Screen, SectionHeader, Segmented, Txt, withAlpha } from '../../ui/components';
import { RADIUS, SPACE, statusColor, useTheme } from '../../ui/theme';
import type { Insight } from './engine';

const LEVEL_GLYPH = { high: '◆', medium: '▲', low: '●' } as const;
const LEVEL_WORD = { high: 'Needs attention', medium: 'Worth a look', low: 'For information' } as const;

export function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { insights, merchants, preset, setPreset, range } = useApp();

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACE.md }]}>
        <View style={styles.header}>
          <Txt variant="title">Insights</Txt>
          <Txt variant="body" tone="secondary">{range.label}</Txt>
        </View>

        <Segmented options={RANGE_OPTIONS} value={preset} onChange={p => void setPreset(p)} />

        {insights.length === 0 ? (
          <EmptyState
            title="Nothing to flag"
            body="No overspending, unusual payments or credit-utilisation risks in this period."
          />
        ) : (
          <View style={styles.list}>
            {insights.map(insight => <InsightCard key={insight.id} insight={insight} />)}
          </View>
        )}

        {merchants.length > 0 ? (
          <View>
            <SectionHeader title="Where your money goes" />
            <Card>
              <CategoryBars
                data={merchants.map(m => ({
                  key: m.key,
                  label: m.label,
                  value: m.debit,
                  meta: `${m.count} ${m.count === 1 ? 'payment' : 'payments'} · ${formatMinor(Math.round(m.debit / m.count))} average`,
                }))}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * Severity is carried by a glyph and a written label as well as colour, because
 * two of the four status hues sit below 3:1 contrast on the light surface and
 * colour alone would not survive greyscale.
 */
function InsightCard({ insight }: { insight: Insight }) {
  const theme = useTheme();
  const color = statusColor(insight.level);

  return (
    <Card style={styles.insight}>
      <View style={styles.insightHead}>
        <View style={[styles.levelChip, { backgroundColor: withAlpha(color, theme.mode === 'dark' ? 0.2 : 0.12) }]}>
          <Txt variant="caption" style={{ color }}>{LEVEL_GLYPH[insight.level]}</Txt>
          <Txt variant="caption" style={{ color }}>{LEVEL_WORD[insight.level]}</Txt>
        </View>
      </View>

      <Txt variant="heading">{insight.title}</Txt>
      <Txt variant="body" tone="secondary">{insight.detail}</Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACE.lg, gap: SPACE.xl, paddingBottom: SPACE.xxxl * 2 },
  header: { gap: 2 },
  list: { gap: SPACE.md },
  insight: { gap: SPACE.sm },
  insightHead: { flexDirection: 'row' },
  levelChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.sm,
  },
});
