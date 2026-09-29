/**
 * Core domain model.
 *
 * Money is ALWAYS stored and passed around as an integer number of minor units
 * (paise for INR). Floating point rupees are a correctness bug waiting to
 * happen once you start summing thousands of rows.
 */

export type Direction = 'debit' | 'credit';

export type Channel =
  | 'upi'
  | 'card'
  | 'netbanking'
  | 'neft'
  | 'imps'
  | 'rtgs'
  | 'atm'
  | 'ach'
  | 'cash'
  | 'unknown';

export type Instrument = 'account' | 'credit_card' | 'debit_card' | 'wallet' | 'unknown';

export type SourceKind = 'sms' | 'email' | 'manual';

export interface Transaction {
  /** Deterministic id derived from the dedupe key. */
  id: string;
  bankId: string;
  /** Last 4 of the account/card as printed in the alert, if any. */
  last4: string | null;
  instrument: Instrument;
  direction: Direction;
  /** Minor units. 45000 === Rs.450.00 */
  amount: number;
  currency: string;
  occurredAt: number;
  merchantRaw: string | null;
  merchant: string | null;
  category: string;
  channel: Channel;
  refNo: string | null;
  /** Minor units, when the alert reports the post-transaction balance. */
  balanceAfter: number | null;
  source: SourceKind;
  /** Provider-scoped id: the SMS `_id`, or the Gmail message id. */
  sourceId: string;
  sender: string;
  templateId: string;
  /** 0..1 — how much the parser trusts this row. */
  confidence: number;
  /** True when the user corrected the category by hand; blocks re-classification. */
  categoryLocked: boolean;
  createdAt: number;
}

/** A parsed-but-not-yet-persisted transaction. */
export type ParsedTransaction = Omit<
  Transaction,
  'id' | 'createdAt' | 'category' | 'merchant' | 'categoryLocked'
> & {
  category?: string;
  merchant?: string | null;
};

export interface Account {
  id: string;
  bankId: string;
  last4: string | null;
  instrument: Instrument;
  /** User-facing name, e.g. "HDFC Salary" — defaults to "<Bank> ••1234". */
  label: string;
  /** Minor units. Credit cards only; user-entered, used for utilisation risk. */
  creditLimit: number | null;
  /** Minor units. Latest known balance, from whichever alert last reported one. */
  lastBalance: number | null;
  lastBalanceAt: number | null;
  archived: boolean;
}

export interface Bank {
  id: string;
  name: string;
  shortName: string;
  color: string;
  /** Uppercase SMS sender-id fragments, e.g. ["HDFCBK", "HDFCBANK"]. */
  smsSenders: string[];
  /** Email domains that send the alerts, e.g. ["hdfcbank.net"]. */
  emailDomains: string[];
}

export interface DateRange {
  from: number;
  to: number;
  label: string;
}

export type RangePreset = 'this_week' | 'this_month' | 'last_month' | 'last_30d' | 'custom';
