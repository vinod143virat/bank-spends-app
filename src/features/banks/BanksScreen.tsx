import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BANKS, bankById } from '../../domain/banks';
import { formatMinor } from '../../domain/money';
import type { Account } from '../../domain/types';
import { RANGE_OPTIONS } from '../../lib/ranges';
import { useApp } from '../../state/store';
import { CategoryBars } from '../../ui/charts';
import { Badge, Card, Divider, Dot, EmptyState, Screen, SectionHeader, Segmented, Txt } from '../../ui/components';
import { RADIUS, SPACE, STATUS, seriesColor, useTheme } from '../../ui/theme';

/**
 * One card per bank, which is how people actually hold the mental model: they
 * do not think "my Swiggy spend", they think "what is happening on my HDFC
 * account". Each card carries the bank's own identity colour AND its name, so
 * the colour is never the only cue.
 */
export function BanksScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { byBank, accounts, preset, setPreset, range } = useApp();

  const cards = useMemo(
    () => byBank.map(slice => ({
      slice,
      bank: bankById.get(slice.key),
      color: seriesColor(theme, BANKS.findIndex(b => b.id === slice.key)),
      accounts: accounts.filter(a => a.bankId === slice.key),
    })),
    [byBank, accounts, theme],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACE.md }]}>
        <View style={styles.header}>
          <Txt variant="title">Banks</Txt>
          <Txt variant="body" tone="secondary">{range.label}</Txt>
        </View>

        <Segmented options={RANGE_OPTIONS} value={preset} onChange={p => void setPreset(p)} />

        {cards.length === 0 ? (
          <EmptyState
            title="No bank activity"
            body="Once alerts are read, each of your banks gets its own dashboard here."
          />
        ) : (
          cards.map(({ slice, bank, color, accounts: bankAccounts }) => (
            <View key={slice.key}>
              <SectionHeader title={bank?.name ?? slice.key} />
              <Card style={styles.bankCard}>
                <View style={styles.bankHead}>
                  <View style={styles.bankName}>
                    <Dot color={color} size={10} />
                    <Txt variant="heading">{bank?.shortName ?? slice.key}</Txt>
                  </View>
                  <Txt variant="caption" tone="muted">
                    {slice.count} {slice.count === 1 ? 'transaction' : 'transactions'}
                  </Txt>
                </View>

                <View style={styles.flowRow}>
                  <View style={styles.flowCell}>
                    <Txt variant="caption" tone="muted" style={styles.upper}>Out</Txt>
                    <Txt variant="heading" tone="debit" tabular>{formatMinor(slice.debit)}</Txt>
                  </View>
                  <View style={[styles.flowDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.flowCell}>
                    <Txt variant="caption" tone="muted" style={styles.upper}>In</Txt>
                    <Txt variant="heading" tone="credit" tabular>{formatMinor(slice.credit)}</Txt>
                  </View>
                </View>

                {bankAccounts.length > 0 ? (
                  <>
                    <Divider />
                    <View style={styles.accounts}>
                      {bankAccounts.map(account => (
                        <AccountLine key={account.id} account={account} />
                      ))}
                    </View>
                  </>
                ) : null}
              </Card>
            </View>
          ))
        )}

        {cards.length > 1 ? (
          <View>
            <SectionHeader title="Compare spend" />
            <Card>
              <CategoryBars
                data={cards.map(({ slice, color }) => ({
                  key: slice.key,
                  label: slice.label,
                  value: slice.debit,
                  color,
                  meta: `${slice.count} transactions`,
                }))}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function AccountLine({ account }: { account: Account }) {
  const theme = useTheme();
  const stale = account.lastBalanceAt !== null && Date.now() - account.lastBalanceAt > 7 * 86_400_000;

  return (
    <View style={styles.accountRow}>
      <View style={styles.accountMain}>
        <Txt variant="body">{account.label}</Txt>
        <Txt variant="caption" tone="muted">{instrumentLabel(account)}</Txt>
      </View>

      {account.lastBalance !== null ? (
        <View style={styles.accountBalance}>
          <Txt variant="bodyStrong" tabular>{formatMinor(account.lastBalance)}</Txt>
          {stale ? <Badge label="STALE" color={STATUS.warning} /> : null}
        </View>
      ) : (
        <View style={[styles.unknown, { backgroundColor: theme.surfaceSunken }]}>
          <Txt variant="caption" tone="muted">Balance not reported</Txt>
        </View>
      )}
    </View>
  );
}

function instrumentLabel(account: Account): string {
  switch (account.instrument) {
    case 'credit_card': return 'Credit card';
    case 'debit_card': return 'Debit card';
    case 'wallet': return 'Wallet';
    case 'account': return 'Bank account';
    default: return 'Unrecognised';
  }
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACE.lg, gap: SPACE.xl, paddingBottom: SPACE.xxxl * 2 },
  header: { gap: 2 },
  bankCard: { gap: SPACE.lg },
  bankHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bankName: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flowRow: { flexDirection: 'row', alignItems: 'center' },
  flowCell: { flex: 1, gap: 2 },
  flowDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: SPACE.lg },
  accounts: { gap: SPACE.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  accountMain: { flex: 1, gap: 1 },
  accountBalance: { alignItems: 'flex-end', gap: SPACE.xs },
  unknown: { paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  upper: { textTransform: 'uppercase' },
});
