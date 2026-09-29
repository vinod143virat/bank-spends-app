import React, { useCallback, useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BANKS, bankById } from '../../domain/banks';
import { formatMinor } from '../../domain/money';
import { onSmsReceived } from '../../ingest/sms/sync';
import { RANGE_OPTIONS } from '../../lib/ranges';
import { useApp } from '../../state/store';
import { CategoryBars, SplitBar, TrendColumns } from '../../ui/charts';
import { Button, Card, Chip, Divider, EmptyState, Screen, SectionHeader, Segmented, Skeleton, Txt } from '../../ui/components';
import { SPACE, seriesColor, useTheme } from '../../ui/theme';
import { TransactionRow } from '../transactions/TransactionRow';
import { StatTile } from './StatTile';

export function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    ready, range, preset, setPreset, totals, byCategory, byBank, trend, recent,
    bankFilter, setBankFilter, smsGranted, grantSms, runSync, syncPhase, refresh,
  } = useApp();

  // A bank alert arriving while the app is open should land on screen without
  // the user reaching for pull-to-refresh.
  useEffect(() => onSmsReceived(() => { void runSync(); }), [runSync]);

  const onRefresh = useCallback(() => { void runSync(); }, [runSync]);

  const bankSegments = useMemo(
    () => byBank
      .filter(slice => slice.debit > 0)
      .map(slice => ({
        key: slice.key,
        label: slice.label,
        value: slice.debit,
        color: seriesColor(theme, BANKS.findIndex(b => b.id === slice.key)),
      })),
    [byBank, theme],
  );

  const categoryData = useMemo(
    () => byCategory.slice(0, 6).map(slice => ({
      key: slice.key,
      label: slice.label,
      value: slice.debit,
      meta: `${slice.count} ${slice.count === 1 ? 'payment' : 'payments'}`,
    })),
    [byCategory],
  );

  const trendData = useMemo(
    () => trend.map(point => ({ day: point.day, value: point.debit })),
    [trend],
  );

  if (!ready) {
    return (
      <Screen>
        <View style={[styles.body, { paddingTop: insets.top + SPACE.lg }]}>
          <Skeleton height={28} width="55%" />
          <View style={styles.tileRow}>
            <Skeleton height={116} style={styles.flex} />
            <Skeleton height={116} style={styles.flex} />
          </View>
          <Skeleton height={180} />
        </View>
      </Screen>
    );
  }

  const net = totals.credit - totals.debit;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACE.md, paddingBottom: SPACE.xxxl * 2 }]}
        refreshControl={
          <RefreshControl
            refreshing={syncPhase === 'syncing'}
            onRefresh={onRefresh}
            tintColor={theme.textMuted}
          />
        }>

        <View style={styles.header}>
          <Txt variant="title">Overview</Txt>
          <Txt variant="body" tone="secondary">{range.label}</Txt>
        </View>

        <Segmented options={RANGE_OPTIONS} value={preset} onChange={p => void setPreset(p)} />

        {!smsGranted ? (
          <Card style={styles.permission}>
            <Txt variant="heading">Connect your bank alerts</Txt>
            <Txt variant="body" tone="secondary">
              Bank SMS alerts are read on this device and never leave it. Messages from
              anyone who is not a bank are filtered out before the app can see them.
            </Txt>
            <Button label="Allow SMS access" onPress={() => void grantSms()} />
          </Card>
        ) : null}

        {totals.count === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body={
              smsGranted
                ? 'No bank alerts found in this period. Try a wider date range, or pull down to sync again.'
                : 'Allow SMS access above, or connect an email account, and your spending will appear here.'
            }
            action={smsGranted ? <Button label="Sync now" variant="secondary" onPress={() => void runSync()} /> : undefined}
          />
        ) : (
          <>
            <View style={styles.tileRow}>
              <StatTile label="Spent" value={totals.debit} tone="spend" caption={`${totals.count} transactions`} />
              <StatTile label="Received" value={totals.credit} tone="income" />
            </View>

            <Card>
              <View style={styles.netRow}>
                <Txt variant="body" tone="secondary">Net for {range.label.toLowerCase()}</Txt>
                <Txt variant="heading" tone={net >= 0 ? 'credit' : 'debit'} tabular>
                  {net >= 0 ? '+' : ''}{formatMinor(net)}
                </Txt>
              </View>
            </Card>

            {trendData.length > 1 ? (
              <View>
                <SectionHeader title="Daily spend" />
                <Card>
                  <TrendColumns data={trendData} />
                </Card>
              </View>
            ) : null}

            {bankSegments.length > 0 ? (
              <View>
                <SectionHeader title="Where it went, by bank" />
                <Card>
                  <SplitBar segments={bankSegments} />
                </Card>
              </View>
            ) : null}

            {categoryData.length > 0 ? (
              <View>
                <SectionHeader
                  title="Top categories"
                  action={<Txt variant="caption" tone="muted">{byCategory.length} total</Txt>}
                />
                <Card>
                  <CategoryBars data={categoryData} />
                </Card>
              </View>
            ) : null}

            <View>
              <SectionHeader title="Filter by bank" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="All banks" active={bankFilter === null} onPress={() => void setBankFilter(null)} />
                {byBank.map(slice => (
                  <Chip
                    key={slice.key}
                    label={bankById.get(slice.key)?.shortName ?? slice.key}
                    color={seriesColor(theme, BANKS.findIndex(b => b.id === slice.key))}
                    active={bankFilter === slice.key}
                    onPress={() => void setBankFilter(bankFilter === slice.key ? null : slice.key)}
                  />
                ))}
              </ScrollView>
            </View>

            <View>
              <SectionHeader title="Recent activity" />
              <Card padded={false}>
                {recent.slice(0, 8).map((tx, index) => (
                  <View key={tx.id}>
                    {index > 0 ? <Divider /> : null}
                    <TransactionRow transaction={tx} onChanged={() => void refresh()} />
                  </View>
                ))}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACE.lg, gap: SPACE.xl },
  header: { gap: 2 },
  tileRow: { flexDirection: 'row', gap: SPACE.md },
  flex: { flex: 1 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  permission: { gap: SPACE.md },
  chips: { gap: SPACE.sm, paddingHorizontal: SPACE.xs, paddingVertical: 2 },
});
