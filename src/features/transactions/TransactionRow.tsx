import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { bankById } from '../../domain/banks';
import { formatMinor } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { setCategory } from '../../db/transactions';
import { CATEGORIES } from '../../parse/merchants';
import { Badge, Button, Chip, Divider, Txt } from '../../ui/components';
import { RADIUS, SPACE, STATUS, useTheme } from '../../ui/theme';

/** Below this the parser is guessing, and the row says so rather than pretending. */
const LOW_CONFIDENCE = 0.7;

export function TransactionRow({
  transaction, onChanged, showBank = true,
}: {
  transaction: Transaction;
  onChanged?: () => void;
  showBank?: boolean;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);

  const isDebit = transaction.direction === 'debit';
  const bank = bankById.get(transaction.bankId);
  const title = transaction.merchant ?? bank?.shortName ?? 'Unknown';

  const subtitle = [
    showBank ? bank?.shortName : null,
    transaction.last4 ? `••${transaction.last4}` : null,
    new Date(transaction.occurredAt).toLocaleString(undefined, {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    }),
  ].filter(Boolean).join('  ·  ');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${isDebit ? 'debit' : 'credit'} ${formatMinor(transaction.amount)}`}
        onPress={() => setEditing(true)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>

        <View style={styles.rowMain}>
          <View style={styles.titleLine}>
            <Txt variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>{title}</Txt>
            {transaction.confidence < LOW_CONFIDENCE ? (
              <Badge label="CHECK" color={STATUS.warning} />
            ) : null}
          </View>
          <Txt variant="caption" tone="muted" numberOfLines={1}>{subtitle}</Txt>
          <View style={[styles.categoryPill, { backgroundColor: theme.surfaceSunken }]}>
            <Txt variant="caption" tone="secondary">{transaction.category}</Txt>
          </View>
        </View>

        <Txt variant="bodyStrong" tone={isDebit ? 'debit' : 'credit'} tabular>
          {isDebit ? '−' : '+'}{formatMinor(transaction.amount)}
        </Txt>
      </Pressable>

      <DetailSheet
        transaction={transaction}
        visible={editing}
        onClose={() => setEditing(false)}
        onChanged={onChanged}
      />
    </>
  );
}

function DetailSheet({
  transaction, visible, onClose, onChanged,
}: {
  transaction: Transaction;
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const theme = useTheme();
  const [saving, setSaving] = useState(false);
  const bank = bankById.get(transaction.bankId);

  async function choose(category: string) {
    setSaving(true);
    try {
      await setCategory(transaction.id, category);
      onChanged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.grabber, { backgroundColor: theme.baseline }]} />

        <Txt variant="title">{transaction.merchant ?? 'Unknown merchant'}</Txt>
        <Txt variant="hero" tone={transaction.direction === 'debit' ? 'debit' : 'credit'}>
          {transaction.direction === 'debit' ? '−' : '+'}{formatMinor(transaction.amount)}
        </Txt>

        <View style={styles.meta}>
          <MetaRow label="Bank" value={bank?.name ?? transaction.bankId} />
          <MetaRow label="Account" value={transaction.last4 ? `••${transaction.last4}` : 'Unknown'} />
          <MetaRow label="When" value={new Date(transaction.occurredAt).toLocaleString()} />
          <MetaRow label="Channel" value={transaction.channel.toUpperCase()} />
          {transaction.refNo ? <MetaRow label="Reference" value={transaction.refNo} /> : null}
          {transaction.balanceAfter !== null
            ? <MetaRow label="Balance after" value={formatMinor(transaction.balanceAfter)} />
            : null}
          <MetaRow label="Read from" value={transaction.source === 'sms' ? `SMS · ${transaction.sender}` : `Email · ${transaction.sender}`} />
        </View>

        <Divider />

        <Txt variant="caption" tone="muted" style={styles.upper}>Category</Txt>
        <ScrollView style={styles.categoryScroll} contentContainerStyle={styles.categoryWrap}>
          {CATEGORIES.map(category => (
            <Chip
              key={category}
              label={category}
              active={category === transaction.category}
              onPress={() => void choose(category)}
            />
          ))}
        </ScrollView>

        {transaction.merchant ? (
          <Txt variant="caption" tone="muted">
            Changing this also recategorises every other payment to {transaction.merchant}.
          </Txt>
        ) : null}

        <Button label="Done" onPress={onClose} busy={saving} />
      </View>
    </Modal>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Txt variant="body" tone="secondary">{label}</Txt>
      <Txt variant="body" numberOfLines={1} style={styles.metaValue}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
  },
  pressed: { opacity: 0.65 },
  rowMain: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flexShrink: { flexShrink: 1 },
  categoryPill: {
    alignSelf: 'flex-start', paddingHorizontal: SPACE.sm,
    paddingVertical: 2, borderRadius: RADIUS.sm, marginTop: 2,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth, padding: SPACE.xl,
    gap: SPACE.md, maxHeight: '88%',
  },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: SPACE.sm },
  meta: { gap: SPACE.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.lg },
  metaValue: { flexShrink: 1, textAlign: 'right' },
  upper: { textTransform: 'uppercase' },
  categoryScroll: { maxHeight: 160 },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, paddingVertical: SPACE.xs },
});
