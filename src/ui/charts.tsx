import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatMinor, formatMinorCompact } from '../domain/money';
import { RADIUS, SPACE, useTheme } from './theme';
import { Dot, Txt, withAlpha } from './components';

/**
 * Marks are plain Views. A chart this simple does not justify pulling in an SVG
 * renderer, and View-backed bars composite on the native side.
 *
 * Shared mark rules, applied by every chart here:
 *   - data-ends are 4px rounded and anchored flat to the baseline
 *   - a 2px surface gap separates adjacent fills
 *   - grid and axis lines are recessive hairlines
 *   - values are direct-labelled selectively, never on every mark
 */

const BAR_RADIUS = 4;
const TRACK_MIN = 3;

// --------------------------------------------------------- category bars ---

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Identity colour. Omitted for single-measure charts, which use one hue. */
  color?: string;
  meta?: string;
}

/**
 * Horizontal bars, sorted by magnitude. One hue throughout unless the caller
 * supplies per-row colours, because length already encodes the comparison -
 * colouring each row differently would imply an identity distinction that is
 * not in the data.
 */
export function CategoryBars({
  data, max, onSelect, showValues = true,
}: {
  data: BarDatum[];
  max?: number;
  onSelect?: (key: string) => void;
  showValues?: boolean;
}) {
  const theme = useTheme();
  if (data.length === 0) return null;

  const ceiling = max ?? Math.max(...data.map(d => d.value), 1);

  return (
    <View style={styles.barList}>
      {data.map(item => {
        const pct = Math.max(TRACK_MIN, (item.value / ceiling) * 100);
        const fill = item.color ?? theme.sequential;

        const row = (
          <View style={styles.barRow}>
            <View style={styles.barHeader}>
              <View style={styles.barLabel}>
                {item.color ? <Dot color={item.color} size={7} /> : null}
                <Txt variant="body" numberOfLines={1}>{item.label}</Txt>
              </View>
              {showValues ? (
                <Txt variant="bodyStrong" tabular>{formatMinor(item.value)}</Txt>
              ) : null}
            </View>

            <View style={[styles.track, { backgroundColor: theme.surfaceSunken }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
            </View>

            {item.meta ? <Txt variant="caption" tone="muted">{item.meta}</Txt> : null}
          </View>
        );

        return onSelect ? (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${formatMinor(item.value)}`}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => pressed && styles.pressed}>
            {row}
          </Pressable>
        ) : (
          <View key={item.key}>{row}</View>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------ trend chart ---

export interface TrendPoint {
  /** Epoch ms at local midnight. */
  day: number;
  value: number;
}

/**
 * Daily spend as columns. A single series, so there is no legend - the caption
 * names it. Only the peak and the last day are direct-labelled; a number on
 * every column would be unreadable at phone width.
 */
export function TrendColumns({ data, height = 132 }: { data: TrendPoint[]; height?: number }) {
  const theme = useTheme();
  if (data.length === 0) return null;

  const peak = Math.max(...data.map(d => d.value), 1);
  const peakIndex = data.findIndex(d => d.value === peak);
  const average = data.reduce((sum, d) => sum + d.value, 0) / data.length;

  return (
    <View>
      <View style={styles.trendHeader}>
        <Txt variant="caption" tone="muted">PEAK {formatMinorCompact(peak)}</Txt>
        <Txt variant="caption" tone="muted">AVG {formatMinorCompact(Math.round(average))}</Txt>
      </View>

      <View style={[styles.plot, { height }]}>
        {/* Recessive average reference line, behind the marks. */}
        <View
          pointerEvents="none"
          style={[
            styles.avgLine,
            { bottom: (average / peak) * height, borderColor: theme.grid },
          ]}
        />

        <View style={styles.columns}>
          {data.map((point, index) => {
            const barHeight = Math.max(2, (point.value / peak) * height);
            const isPeak = index === peakIndex;
            return (
              <View
                key={point.day}
                accessibilityLabel={`${new Date(point.day).toDateString()}, ${formatMinor(point.value)}`}
                style={[
                  styles.column,
                  {
                    height: barHeight,
                    backgroundColor: isPeak ? theme.sequential : withAlpha(theme.sequential, 0.45),
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={[styles.baseline, { backgroundColor: theme.baseline }]} />

      <View style={styles.trendAxis}>
        <Txt variant="caption" tone="muted">{shortDay(data[0].day)}</Txt>
        <Txt variant="caption" tone="muted">{shortDay(data[data.length - 1].day)}</Txt>
      </View>
    </View>
  );
}

// ------------------------------------------------------------- split bar ---

/**
 * A single stacked bar showing how the period's spend splits across banks.
 * Segments are separated by a 2px surface gap so adjacent fills never touch,
 * and the legend below direct-labels every segment - the bar itself is a
 * summary, not the read.
 */
export function SplitBar({ segments }: { segments: BarDatum[] }) {
  const theme = useTheme();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <View>
      <View style={styles.splitTrack}>
        {segments.map((segment, index) => (
          <View
            key={segment.key}
            style={{
              flex: segment.value,
              backgroundColor: segment.color ?? theme.sequential,
              marginLeft: index === 0 ? 0 : 2,
              borderTopLeftRadius: index === 0 ? BAR_RADIUS : 0,
              borderBottomLeftRadius: index === 0 ? BAR_RADIUS : 0,
              borderTopRightRadius: index === segments.length - 1 ? BAR_RADIUS : 0,
              borderBottomRightRadius: index === segments.length - 1 ? BAR_RADIUS : 0,
            }}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {segments.map(segment => (
          <View key={segment.key} style={styles.legendItem}>
            <Dot color={segment.color ?? theme.sequential} size={7} />
            <Txt variant="label" tone="secondary">{segment.label}</Txt>
            <Txt variant="label" tabular>{Math.round((segment.value / total) * 100)}%</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function shortDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.65 },
  barList: { gap: SPACE.lg },
  barRow: { gap: SPACE.sm },
  barHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  barLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexShrink: 1 },
  track: { height: 8, borderRadius: BAR_RADIUS, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: BAR_RADIUS },

  plot: { justifyContent: 'flex-end' },
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  column: { flex: 1, borderTopLeftRadius: BAR_RADIUS, borderTopRightRadius: BAR_RADIUS },
  avgLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  baseline: { height: 1, marginTop: 1 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACE.sm },
  trendAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.xs },

  splitTrack: { flexDirection: 'row', height: 10, borderRadius: BAR_RADIUS },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});

export { RADIUS };
