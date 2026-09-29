import type { Template } from '../types';

/**
 * Shared sub-patterns. Kept as strings so they can be composed into the
 * per-bank regexes without repeating the awkward bits.
 *
 *  AMT   - "1,234.50" / "450.0" / "1200"
 *  L4    - last four digits behind any masking characters (x, X, *, XX)
 *  CUR   - the currency token, which banks spell four different ways
 */
const AMT = String.raw`(?<amount>\d[\d,]*(?:\.\d{1,2})?)`;
const BAL = String.raw`(?<balance>\d[\d,]*(?:\.\d{1,2})?)`;
const L4 = String.raw`(?:[xX*#]+\s?)(?<last4>\d{4})`;
const L4_LOOSE = String.raw`(?:(?:no\.?|number)?\s*[xX*#]+\s?)(?<last4>\d{3,4})`;
const CUR = String.raw`(?:INR|Rs\.?|₹)`;
const DATE = String.raw`(?<date>\d{1,4}[-/.\s]?[A-Za-z0-9]{2,3}[-/.\s]?\d{2,4}(?:[:,\s]+\d{1,2}:\d{2}(?::\d{2})?)?)`;

export const TEMPLATES: Template[] = [
  // ---------------------------------------------------------------- HDFC ---
  {
    id: 'hdfc.upi.debit',
    bankId: 'hdfc',
    direction: 'debit',
    channel: 'upi',
    instrument: 'account',
    confidence: 0.97,
    pattern: new RegExp(
      String.raw`Sent\s+${CUR}\s*${AMT}\s+From\s+HDFC\s+Bank\s+A/?C\s*${L4}\s+To\s+(?<merchant>.+?)\s+On\s+${DATE}(?:.*?Ref\s*(?<ref>\d+))?`,
      'is',
    ),
  },
  {
    id: 'hdfc.card.spend',
    bankId: 'hdfc',
    direction: 'debit',
    channel: 'card',
    instrument: 'credit_card',
    confidence: 0.97,
    pattern: new RegExp(
      String.raw`Spent\s+${CUR}\s*${AMT}\s+On\s+HDFC\s+Bank\s+(?<cardtype>CREDIT|DEBIT)?\s*Card\s*${L4}\s+At\s+(?<merchant>.+?)\s+On\s+${DATE}`,
      'is',
    ),
  },
  {
    id: 'hdfc.acct.credit',
    bankId: 'hdfc',
    direction: 'credit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.95,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}\s+credited\s+to\s+(?:your\s+)?HDFC\s+Bank\s+A/?c\s*${L4}\s+on\s+${DATE}(?:.*?(?:VPA|by)\s+(?<merchant>[^\s,.]+))?(?:.*?\(UPI[:\s]*(?<ref>\d+)\))?`,
      'is',
    ),
  },
  {
    id: 'hdfc.acct.debit',
    bankId: 'hdfc',
    direction: 'debit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.93,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}\s+(?:has\s+been\s+)?debited\s+from\s+(?:your\s+)?HDFC\s+Bank\s+A/?c\s*${L4}\s+on\s+${DATE}(?:.*?to\s+(?<merchant>.+?)(?:\.|\s+Ref|$))?`,
      'is',
    ),
  },
  {
    id: 'hdfc.atm.withdrawal',
    bankId: 'hdfc',
    direction: 'debit',
    channel: 'atm',
    instrument: 'debit_card',
    confidence: 0.95,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}\s+(?:was\s+)?withdrawn\s+from\s+HDFC\s+Bank\s+ATM.*?Card\s*${L4}.*?on\s+${DATE}`,
      'is',
    ),
  },

  // --------------------------------------------------------------- ICICI ---
  {
    id: 'icici.upi.debit',
    bankId: 'icici',
    direction: 'debit',
    channel: 'upi',
    instrument: 'account',
    confidence: 0.96,
    pattern: new RegExp(
      String.raw`(?:ICICI\s+Bank\s+)?Acc?t\s*${L4_LOOSE}\s+debited\s+(?:with|for)\s+${CUR}\s*${AMT}\s+on\s+${DATE}[;,.]?\s*(?<merchant>.+?)\s+credited(?:.*?UPI[:\s]*(?<ref>\d+))?`,
      'is',
    ),
  },
  {
    id: 'icici.card.spend',
    bankId: 'icici',
    direction: 'debit',
    channel: 'card',
    instrument: 'credit_card',
    confidence: 0.96,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}\s+spent\s+using\s+ICICI\s+Bank\s+Card\s*${L4}\s+on\s+${DATE}\s+on\s+(?<merchant>.+?)(?:\.\s|\.$|$)`,
      'is',
    ),
  },
  {
    id: 'icici.acct.credit',
    bankId: 'icici',
    direction: 'credit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.95,
    pattern: new RegExp(
      String.raw`(?:ICICI\s+Bank\s+)?Acc?t\s*${L4_LOOSE}\s+credited\s+with\s+${CUR}\s*${AMT}\s+on\s+${DATE}(?:.*?from\s+(?<merchant>.+?)(?:\.|$))?`,
      'is',
    ),
  },
  {
    id: 'icici.acct.debit.generic',
    bankId: 'icici',
    direction: 'debit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.9,
    pattern: new RegExp(
      String.raw`(?:ICICI\s+Bank\s+)?Acc?t\s*${L4_LOOSE}\s+(?:is\s+)?debited\s+(?:with|for|by)\s+${CUR}\s*${AMT}\s+on\s+${DATE}`,
      'is',
    ),
  },

  // ----------------------------------------------------------------- SBI ---
  {
    id: 'sbi.upi.debit',
    bankId: 'sbi',
    direction: 'debit',
    channel: 'upi',
    instrument: 'account',
    confidence: 0.96,
    pattern: new RegExp(
      String.raw`A/?C\s*${L4_LOOSE}\s+debited\s+by\s+${AMT}\s+on\s+date\s+${DATE}\s+trf\s+to\s+(?<merchant>.+?)\s+Refno\s+(?<ref>\d+)`,
      'is',
    ),
  },
  {
    id: 'sbi.upi.credit',
    bankId: 'sbi',
    direction: 'credit',
    channel: 'upi',
    instrument: 'account',
    confidence: 0.96,
    pattern: new RegExp(
      String.raw`A/?C\s*${L4_LOOSE}\s+credited\s+by\s+${AMT}\s+on\s+date\s+${DATE}\s+(?:trf|transfer)\s+from\s+(?<merchant>.+?)\s+Refno\s+(?<ref>\d+)`,
      'is',
    ),
  },
  {
    id: 'sbi.acct.debit',
    bankId: 'sbi',
    direction: 'debit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.92,
    pattern: new RegExp(
      String.raw`(?:Your\s+)?a/?c\s*(?:no\.?\s*)?${L4_LOOSE}\s+is\s+debited\s+(?:for|by)\s+${CUR}\s*${AMT}\s+on\s+${DATE}`,
      'is',
    ),
  },
  {
    id: 'sbi.acct.credit',
    bankId: 'sbi',
    direction: 'credit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.92,
    pattern: new RegExp(
      String.raw`(?:Your\s+)?A/?c\s*${L4_LOOSE}\s*-?\s*credited\s+by\s+${CUR}\s*${AMT}\s+on\s+${DATE}(?:\s+transfer\s+from\s+(?<merchant>.+?)(?:\s|$))?`,
      'is',
    ),
  },

  // ---------------------------------------------------------------- AXIS ---
  {
    id: 'axis.acct.debit',
    bankId: 'axis',
    direction: 'debit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.96,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}\s+debited\s+from\s+A/?c\s*(?:no\.?\s*)?${L4_LOOSE}\s+on\s+${DATE}.*?Info-?\s*(?<merchant>[^.]+?)(?:\.|\s+Avl)(?:.*?Avl\s+Bal[-:\s]+${CUR}\s*${BAL})?`,
      'is',
    ),
  },
  {
    id: 'axis.acct.credit',
    bankId: 'axis',
    direction: 'credit',
    channel: 'unknown',
    instrument: 'account',
    confidence: 0.95,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}\s+credited\s+to\s+A/?c\s*(?:no\.?\s*)?${L4_LOOSE}\s+on\s+${DATE}(?:.*?Info-?\s*(?<merchant>[^.]+?)(?:\.|\s+Avl))?(?:.*?Avl\s+Bal[-:\s]+${CUR}\s*${BAL})?`,
      'is',
    ),
  },
  {
    id: 'axis.card.spend',
    bankId: 'axis',
    direction: 'debit',
    channel: 'card',
    instrument: 'credit_card',
    confidence: 0.95,
    pattern: new RegExp(
      String.raw`Spent\s+Card\s*(?:no\.?\s*)?${L4_LOOSE}\s+${CUR}\s*${AMT}\s+${DATE}\s+(?<merchant>.+?)\s+Avl\s+Lmt`,
      'is',
    ),
  },

  // --------------------------------------------------------------- KOTAK ---
  {
    id: 'kotak.upi.debit',
    bankId: 'kotak',
    direction: 'debit',
    channel: 'upi',
    instrument: 'account',
    confidence: 0.96,
    pattern: new RegExp(
      String.raw`Sent\s+${CUR}\s*${AMT}\s+from\s+Kotak\s+Bank\s+AC\s*${L4_LOOSE}\s+to\s+(?<merchant>\S+?)\s+on\s+${DATE}\s*\.?\s*UPI\s+Ref\s*(?<ref>\d+)`,
      'is',
    ),
  },
  {
    id: 'kotak.upi.credit',
    bankId: 'kotak',
    direction: 'credit',
    channel: 'upi',
    instrument: 'account',
    confidence: 0.96,
    pattern: new RegExp(
      String.raw`Received\s+${CUR}\s*${AMT}\s+in\s+your\s+Kotak\s+Bank\s+AC\s*${L4_LOOSE}\s+from\s+(?<merchant>\S+?)\s+on\s+${DATE}\s*\.?\s*UPI\s+Ref\s*(?<ref>\d+)`,
      'is',
    ),
  },
  {
    id: 'kotak.card.spend',
    bankId: 'kotak',
    direction: 'debit',
    channel: 'card',
    instrument: 'credit_card',
    confidence: 0.94,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}\s+spent\s+on\s+Kotak\s+Bank\s+Card\s*${L4_LOOSE}\s+at\s+(?<merchant>.+?)\s+on\s+${DATE}`,
      'is',
    ),
  },

  // ------------------------------------------------------------- GENERIC ---
  // Last-resort patterns. They fire for banks with no dedicated template and
  // score low enough that the UI flags the row for review.
  {
    id: 'generic.debit',
    bankId: null,
    direction: 'debit',
    channel: 'unknown',
    instrument: 'unknown',
    confidence: 0.55,
    pattern: new RegExp(
      String.raw`(?:A/?c|Acc?t|Card)\s*${L4_LOOSE}[\s\S]{0,40}?\bdebited\b[\s\S]{0,20}?${CUR}\s*${AMT}`,
      'i',
    ),
  },
  {
    id: 'generic.debit.reversed',
    bankId: null,
    direction: 'debit',
    channel: 'unknown',
    instrument: 'unknown',
    confidence: 0.5,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}[\s\S]{0,40}?\b(?:debited|spent|withdrawn|paid)\b[\s\S]{0,40}?(?:A/?c|Acc?t|Card)\s*${L4_LOOSE}`,
      'i',
    ),
  },
  {
    id: 'generic.credit',
    bankId: null,
    direction: 'credit',
    channel: 'unknown',
    instrument: 'unknown',
    confidence: 0.55,
    pattern: new RegExp(
      String.raw`(?:A/?c|Acc?t)\s*${L4_LOOSE}[\s\S]{0,40}?\bcredited\b[\s\S]{0,20}?${CUR}\s*${AMT}`,
      'i',
    ),
  },
  {
    id: 'generic.credit.reversed',
    bankId: null,
    direction: 'credit',
    channel: 'unknown',
    instrument: 'unknown',
    confidence: 0.5,
    pattern: new RegExp(
      String.raw`${CUR}\s*${AMT}[\s\S]{0,40}?\bcredited\b[\s\S]{0,40}?(?:A/?c|Acc?t)\s*${L4_LOOSE}`,
      'i',
    ),
  },
];

/** Templates for a bank, most specific first, with the generics appended. */
export function templatesFor(bankId: string | null): Template[] {
  const specific = bankId ? TEMPLATES.filter(t => t.bankId === bankId) : [];
  const generic = TEMPLATES.filter(t => t.bankId === null);
  return [...specific, ...generic];
}
