import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resetDatabase } from '../../db';
import { formatMinor } from '../../domain/money';
import { useApp } from '../../state/store';
import { Button, Card, Divider, Screen, SectionHeader, Txt } from '../../ui/components';
import { SPACE, useTheme } from '../../ui/theme';

export function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { smsGranted, grantSms, runSync, syncPhase, lastSync, accounts, refresh, error } = useApp();
  const [wiping, setWiping] = useState(false);

  function confirmWipe() {
    Alert.alert(
      'Erase all data?',
      'Every transaction, account and category rule on this device is deleted. ' +
        'Your SMS and email are untouched, so a re-sync rebuilds the history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            setWiping(true);
            try {
              await resetDatabase();
              await refresh();
            } finally {
              setWiping(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACE.md }]}>
        <Txt variant="title">Settings</Txt>

        <View>
          <SectionHeader title="Sources" />
          <Card style={styles.card}>
            <View style={styles.sourceRow}>
              <View style={styles.sourceMain}>
                <Txt variant="bodyStrong">Bank SMS</Txt>
                <Txt variant="caption" tone="muted">
                  {smsGranted ? 'Connected. Read on this device only.' : 'Not connected'}
                </Txt>
              </View>
              {smsGranted
                ? <Button label="Sync" variant="secondary" onPress={() => void runSync()} busy={syncPhase === 'syncing'} />
                : <Button label="Connect" onPress={() => void grantSms()} />}
            </View>

            <Divider />

            <View style={styles.sourceRow}>
              <View style={styles.sourceMain}>
                <Txt variant="bodyStrong">Email (Gmail / Outlook)</Txt>
                <Txt variant="caption" tone="muted">
                  Not yet available in this build. See docs/ROADMAP.md.
                </Txt>
              </View>
              <Button label="Connect" variant="secondary" disabled onPress={() => {}} />
            </View>
          </Card>
        </View>

        {lastSync ? (
          <View>
            <SectionHeader title="Last sync" />
            <Card style={styles.stats}>
              <StatLine label="Bank messages read" value={String(lastSync.messagesRead)} />
              <StatLine label="New transactions" value={String(lastSync.inserted)} />
              <StatLine label="Merged duplicates" value={String(lastSync.merged)} />
              <StatLine label="Not recognised" value={String(lastSync.unparsed)} />
            </Card>
          </View>
        ) : null}

        {accounts.some(a => a.instrument === 'credit_card') ? (
          <View>
            <SectionHeader title="Credit limits" />
            <Card style={styles.card}>
              <Txt variant="body" tone="secondary">
                Alerts do not carry your credit limit. Add it and the app can warn you
                before utilisation crosses the 30% mark that affects your score.
              </Txt>
              {accounts.filter(a => a.instrument === 'credit_card').map(account => (
                <View key={account.id} style={styles.limitRow}>
                  <Txt variant="body">{account.label}</Txt>
                  <Txt variant="bodyStrong" tone={account.creditLimit ? 'primary' : 'muted'} tabular>
                    {account.creditLimit ? formatMinor(account.creditLimit) : 'Not set'}
                  </Txt>
                </View>
              ))}
              <Txt variant="caption" tone="muted">
                Editing limits arrives with the accounts screen; the repository call
                behind it is already in place.
              </Txt>
            </Card>
          </View>
        ) : null}

        <View>
          <SectionHeader title="Your data" />
          <Card style={styles.card}>
            <Txt variant="body" tone="secondary">
              Everything stays on this phone. There is no server, no account and no
              upload. Only the derived transaction is kept, never the message text.
            </Txt>
            <Button label="Erase all data" variant="secondary" onPress={confirmWipe} busy={wiping} />
          </Card>
        </View>

        {error ? (
          <Card style={[styles.card, { borderColor: theme.debit }]}>
            <Txt variant="bodyStrong" tone="debit">Something went wrong</Txt>
            <Txt variant="caption" tone="muted">{error}</Txt>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statLine}>
      <Txt variant="body" tone="secondary">{label}</Txt>
      <Txt variant="bodyStrong" tabular>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACE.lg, gap: SPACE.xl, paddingBottom: SPACE.xxxl * 2 },
  card: { gap: SPACE.lg },
  stats: { gap: SPACE.sm },
  sourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  sourceMain: { flex: 1, gap: 2 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between' },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
