import React, { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { RANGE_OPTIONS } from '../../lib/ranges';
import { useApp } from '../../state/store';
import { Card, Chip, Divider, EmptyState, Screen, Segmented, Txt } from '../../ui/components';
import { SPACE } from '../../ui/theme';
import { TransactionRow } from './TransactionRow';

type Filter = 'all' | 'debit' | 'credit';

export function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { recent, preset, setPreset, range, refresh } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const sections = useMemo(() => {
    const filtered = filter === 'all' ? recent : recent.filter(t => t.direction === filter);
    return groupByDay(filtered);
  }, [recent, filter]);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + SPACE.md }]}>
        <Txt variant="title">Transactions</Txt>
        <Txt variant="body" tone="secondary">{range.label}</Txt>

        <View style={styles.controls}>
          <Segmented options={RANGE_OPTIONS} value={preset} onChange={p => void setPreset(p)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Money out" active={filter === 'debit'} onPress={() => setFilter('debit')} />
            <Chip label="Money in" active={filter === 'credit'} onPress={() => setFilter('credit')} />
          </ScrollView>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="No transactions"
            body="Nothing matches this period and filter. Try widening the date range."
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Txt variant="caption" tone="muted" style={styles.upper}>{section.title}</Txt>
            <Txt variant="caption" tone="muted" tabular>{formatMinor(section.total)} out</Txt>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <Card padded={false} style={cardEdges(index, section.data.length)}>
            {index > 0 ? <Divider /> : null}
            <TransactionRow transaction={item} onChanged={() => void refresh()} />
          </Card>
        )}
      />
    </Screen>
  );
}

/**
 * Rounded corners belong to the group, not to every row, so a day's
 * transactions read as one card rather than a stack of separate ones.
 */
function cardEdges(index: number, count: number) {
  const first = index === 0;
  const last = index === count - 1;
  return {
    borderTopLeftRadius: first ? undefined : 0,
    borderTopRightRadius: first ? undefined : 0,
    borderBottomLeftRadius: last ? undefined : 0,
    borderBottomRightRadius: last ? undefined : 0,
    borderTopWidth: first ? undefined : 0,
    borderBottomWidth: last ? undefined : 0,
  };
}

interface DaySection {
  title: string;
  total: number;
  data: Transaction[];
}

function groupByDay(transactions: Transaction[]): DaySection[] {
  const map = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const key = new Date(tx.occurredAt).toDateString();
    const list = map.get(key) ?? [];
    list.push(tx);
    map.set(key, list);
  }

  return [...map.entries()].map(([key, data]) => ({
    title: friendlyDay(new Date(key)),
    total: data.reduce((sum, t) => (t.direction === 'debit' ? sum + t.amount : sum), 0),
    data,
  }));
}

function friendlyDay(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.lg, gap: 2, paddingBottom: SPACE.md },
  controls: { gap: SPACE.md, marginTop: SPACE.md },
  chips: { gap: SPACE.sm, paddingHorizontal: 2, paddingVertical: 2 },
  list: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxxl * 2 },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: SPACE.xl, marginBottom: SPACE.sm, paddingHorizontal: SPACE.xs,
  },
  upper: { textTransform: 'uppercase' },
});
