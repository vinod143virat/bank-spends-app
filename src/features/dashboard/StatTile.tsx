import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMinor } from '../../domain/money';
import { Card, Txt } from '../../ui/components';
import { RADIUS, SPACE, useTheme } from '../../ui/theme';

/**
 * A stat tile is a hero number, not a chart. The delta is the only coloured
 * element and always ships with an arrow glyph, so the direction survives
 * greyscale and colour-vision deficiency.
 */
export function StatTile({
  label, value, deltaPct, tone = 'neutral', caption, flex = 1,
}: {
  label: string;
  value: number;
  /** Percentage change against the comparable prior period. */
  deltaPct?: number | null;
  /** Which direction is good. Spend going up is bad; income going up is good. */
  tone?: 'spend' | 'income' | 'neutral';
  caption?: string;
  flex?: number;
}) {
  const theme = useTheme();

  const delta = deltaPct == null || !isFinite(deltaPct) ? null : Math.round(deltaPct);
  const rising = (delta ?? 0) > 0;
  const good = tone === 'neutral' ? null : tone === 'spend' ? !rising : rising;
  const deltaColor = good === null ? theme.textMuted : good ? theme.credit : theme.debit;

  return (
    <Card style={[styles.tile, { flex }]}>
      <Txt variant="caption" tone="muted" style={styles.upper}>{label}</Txt>
      <Txt variant="hero" numberOfLines={1} style={styles.value}>{formatMinor(value)}</Txt>

      {delta !== null && delta !== 0 ? (
        <View style={[styles.delta, { backgroundColor: theme.surfaceSunken, borderRadius: RADIUS.sm }]}>
          <Txt variant="caption" style={{ color: deltaColor }}>
            {rising ? '↑' : '↓'} {Math.abs(delta)}%
          </Txt>
          <Txt variant="caption" tone="muted">vs last period</Txt>
        </View>
      ) : caption ? (
        <Txt variant="caption" tone="muted">{caption}</Txt>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { gap: SPACE.sm, minHeight: 116, justifyContent: 'space-between' },
  upper: { textTransform: 'uppercase' },
  value: { marginTop: 2 },
  delta: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    alignSelf: 'flex-start', paddingHorizontal: SPACE.sm, paddingVertical: 3,
  },
});
