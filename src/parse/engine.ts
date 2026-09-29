import { bankIdFromEmailAddress, bankIdFromSmsSender } from '../domain/banks';
import { parseAmountToMinor } from '../domain/money';
import type { Instrument, ParsedTransaction } from '../domain/types';
import { stableHash } from '../lib/hash';
import { parseBankDate, resolveOccurredAt } from './date';
import { categorize, normalizeMerchant } from './merchants';
import { isNonTransactional } from './noise';
import { templatesFor } from './templates/india';
import type { RawMessage, Template } from './types';

export interface ParseResult {
  transaction: ParsedTransaction | null;
  /** Why nothing was produced — surfaced in the debug screen, not the UI. */
  reason?: 'non_transactional' | 'unknown_sender' | 'no_template_matched' | 'bad_amount';
}

export function parseMessage(msg: RawMessage): ParseResult {
  if (isNonTransactional(msg.body)) {
    return { transaction: null, reason: 'non_transactional' };
  }

  const bankId =
    msg.source === 'sms'
      ? bankIdFromSmsSender(msg.sender)
      : bankIdFromEmailAddress(msg.sender);

  if (!bankId) {
    return { transaction: null, reason: 'unknown_sender' };
  }

  for (const template of templatesFor(bankId)) {
    const match = template.pattern.exec(msg.body);
    if (!match?.groups) continue;

    const built = build(msg, bankId, template, match.groups);
    if (built) return { transaction: built };
  }

  return { transaction: null, reason: 'no_template_matched' };
}

function build(
  msg: RawMessage,
  bankId: string,
  template: Template,
  groups: Record<string, string | undefined>,
): ParsedTransaction | null {
  const amount = parseAmountToMinor(groups.amount ?? '');
  if (amount === null || amount === 0) return null;

  const occurredAt = resolveOccurredAt(parseBankDate(groups.date), msg.receivedAt);
  const merchantRaw = groups.merchant?.trim() || null;
  const merchant = normalizeMerchant(merchantRaw);
  const balance = groups.balance ? parseAmountToMinor(groups.balance) : null;

  return {
    bankId,
    last4: groups.last4 ?? null,
    instrument: resolveInstrument(template, groups, msg.body),
    direction: template.direction,
    amount,
    currency: 'INR',
    occurredAt,
    merchantRaw,
    merchant,
    category: categorize(merchant, msg.body, template.direction),
    channel: resolveChannel(template, msg.body),
    refNo: groups.ref ?? null,
    balanceAfter: balance,
    source: msg.source,
    sourceId: msg.sourceId,
    sender: msg.sender,
    templateId: template.id,
    confidence: template.confidence,
  };
}

/**
 * HDFC's card template covers both credit and debit cards and says which in the
 * message; everything else takes the template's declared instrument.
 */
function resolveInstrument(
  template: Template,
  groups: Record<string, string | undefined>,
  body: string,
): Instrument {
  if (groups.cardtype) {
    return groups.cardtype.toUpperCase() === 'DEBIT' ? 'debit_card' : 'credit_card';
  }
  if (template.instrument !== 'unknown') return template.instrument;
  if (/\bcredit\s+card\b/i.test(body)) return 'credit_card';
  if (/\bdebit\s+card\b/i.test(body)) return 'debit_card';
  if (/\bcard\b/i.test(body)) return 'debit_card';
  return 'account';
}

/** The generic templates do not know the rail, so it is sniffed from the body. */
function resolveChannel(template: Template, body: string) {
  if (template.channel !== 'unknown') return template.channel;
  if (/\bUPI\b/i.test(body)) return 'upi' as const;
  if (/\bATM\b|cash\s*w(?:it)?hdr/i.test(body)) return 'atm' as const;
  if (/\bNEFT\b/i.test(body)) return 'neft' as const;
  if (/\bIMPS\b/i.test(body)) return 'imps' as const;
  if (/\bRTGS\b/i.test(body)) return 'rtgs' as const;
  if (/\bACH\b|mandate|autopay|e-?nach/i.test(body)) return 'ach' as const;
  if (/\bcard\b|\bPOS\b|\bECOM\b/i.test(body)) return 'card' as const;
  return 'unknown' as const;
}

/**
 * Identity of a transaction as an event in the world, independent of which
 * channel told us about it. Two messages sharing this id describe one payment.
 *
 * The timestamp is bucketed to 5 minutes because an SMS and its matching email
 * rarely carry the same second. Bucketing alone would still split a pair that
 * straddles a boundary, so `findDuplicate` in the repository also does a
 * time-window lookup; this id is the fast path.
 */
export function transactionId(tx: ParsedTransaction): string {
  const bucket = Math.floor(tx.occurredAt / 300_000);
  const key = [
    tx.bankId,
    tx.last4 ?? '?',
    tx.direction,
    tx.amount,
    tx.refNo ?? bucket,
  ].join('|');
  return stableHash(key);
}
