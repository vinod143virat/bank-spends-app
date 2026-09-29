import type { Scalar } from '@op-engineering/op-sqlite';
import { bankById } from '../domain/banks';
import type { Account, DateRange, Transaction } from '../domain/types';
import type { ParsedTransaction } from '../domain/types';
import { transactionId } from '../parse/engine';
import { db } from './index';

/**
 * How far apart two alerts describing the same payment may be. An SMS and the
 * matching email routinely land minutes apart, and the timestamps the bank
 * prints in each disagree by more than the transport delay.
 */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export interface IngestOutcome {
  inserted: number;
  merged: number;
  skipped: number;
}

/**
 * Persists parsed transactions, collapsing the ones that describe a payment we
 * already know about.
 *
 * Two rows are the same payment when they agree on bank, direction and amount
 * and either share a reference number or fall inside the dedupe window. The
 * surviving row keeps the richest data from both, because SMS and email each
 * carry fields the other omits: SMS usually has the reference number, email
 * usually has the full merchant name.
 */
export async function ingestTransactions(
  parsed: ParsedTransaction[],
): Promise<IngestOutcome> {
  const outcome: IngestOutcome = { inserted: 0, merged: 0, skipped: 0 };
  const handle = db();

  for (const tx of parsed) {
    const existing = await findDuplicate(tx);

    if (existing) {
      const changed = await mergeInto(existing, tx);
      changed ? outcome.merged++ : outcome.skipped++;
      continue;
    }

    const row: Transaction = {
      ...tx,
      id: transactionId(tx),
      merchant: tx.merchant ?? null,
      category: tx.category ?? 'Uncategorised',
      categoryLocked: false,
      createdAt: Date.now(),
    };

    await handle.execute(
      `INSERT INTO transactions (
         id, bank_id, account_id, last4, instrument, direction, amount, currency,
         occurred_at, merchant_raw, merchant, category, channel, ref_no,
         balance_after, source, source_id, sender, template_id, confidence,
         category_locked, created_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO NOTHING`,
      [
        row.id, row.bankId, accountIdFor(row), row.last4, row.instrument,
        row.direction, row.amount, row.currency, row.occurredAt, row.merchantRaw,
        row.merchant, row.category, row.channel, row.refNo, row.balanceAfter,
        row.source, row.sourceId, row.sender, row.templateId, row.confidence,
        0, row.createdAt,
      ],
    );

    outcome.inserted++;
    await upsertAccountFrom(row);
  }

  return outcome;
}

async function findDuplicate(tx: ParsedTransaction): Promise<Transaction | null> {
  const handle = db();

  // A shared reference number is conclusive regardless of how far apart the
  // two alerts claim the payment happened.
  if (tx.refNo) {
    const byRef = await handle.execute(
      `SELECT * FROM transactions
        WHERE bank_id = ? AND direction = ? AND amount = ? AND ref_no = ?
        LIMIT 1`,
      [tx.bankId, tx.direction, tx.amount, tx.refNo],
    );
    if (byRef.rows.length) return mapRow(byRef.rows[0]);
  }

  const byWindow = await handle.execute(
    `SELECT * FROM transactions
      WHERE bank_id = ? AND direction = ? AND amount = ?
        AND occurred_at BETWEEN ? AND ?
        AND (last4 IS NULL OR ? IS NULL OR last4 = ?)
      ORDER BY ABS(occurred_at - ?) ASC
      LIMIT 1`,
    [
      tx.bankId, tx.direction, tx.amount,
      tx.occurredAt - DEDUPE_WINDOW_MS, tx.occurredAt + DEDUPE_WINDOW_MS,
      tx.last4, tx.last4, tx.occurredAt,
    ],
  );

  return byWindow.rows.length ? mapRow(byWindow.rows[0]) : null;
}

/** Fills gaps in the stored row from the incoming one. Returns true if anything changed. */
async function mergeInto(existing: Transaction, incoming: ParsedTransaction): Promise<boolean> {
  const patch: Record<string, Scalar> = {};

  if (!existing.refNo && incoming.refNo) patch.ref_no = incoming.refNo;
  if (!existing.last4 && incoming.last4) patch.last4 = incoming.last4;
  if (!existing.merchant && incoming.merchant) patch.merchant = incoming.merchant;
  if (!existing.merchantRaw && incoming.merchantRaw) patch.merchant_raw = incoming.merchantRaw;
  if (existing.balanceAfter === null && incoming.balanceAfter !== null) {
    patch.balance_after = incoming.balanceAfter;
  }
  if (existing.instrument === 'unknown' && incoming.instrument !== 'unknown') {
    patch.instrument = incoming.instrument;
  }
  if (existing.channel === 'unknown' && incoming.channel !== 'unknown') {
    patch.channel = incoming.channel;
  }
  // A higher-confidence template supersedes the row's provenance and category,
  // unless the user has pinned the category by hand.
  if (incoming.confidence > existing.confidence) {
    patch.confidence = incoming.confidence;
    patch.template_id = incoming.templateId;
    if (!existing.categoryLocked && incoming.category) {
      patch.category = incoming.category;
    }
  }

  const keys = Object.keys(patch);
  if (keys.length === 0) return false;

  await db().execute(
    `UPDATE transactions SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
    [...keys.map(k => patch[k]), existing.id],
  );
  return true;
}

function accountIdFor(tx: Transaction): string {
  return `${tx.bankId}:${tx.instrument}:${tx.last4 ?? 'unknown'}`;
}

/** Keeps the accounts table in step with whatever the alerts reveal. */
async function upsertAccountFrom(tx: Transaction): Promise<void> {
  const id = accountIdFor(tx);
  const bank = bankById.get(tx.bankId);
  const suffix = tx.last4 ? `••${tx.last4}` : 'Account';
  const label = `${bank?.shortName ?? tx.bankId} ${suffix}`;

  await db().execute(
    `INSERT INTO accounts (id, bank_id, last4, instrument, label, credit_limit,
                           last_balance, last_balance_at, archived)
     VALUES (?,?,?,?,?,NULL,?,?,0)
     ON CONFLICT(id) DO UPDATE SET
       last_balance    = COALESCE(excluded.last_balance, accounts.last_balance),
       last_balance_at = CASE
         WHEN excluded.last_balance IS NOT NULL
          AND (accounts.last_balance_at IS NULL
               OR excluded.last_balance_at > accounts.last_balance_at)
         THEN excluded.last_balance_at ELSE accounts.last_balance_at END`,
    [
      id, tx.bankId, tx.last4, tx.instrument, label,
      tx.balanceAfter, tx.balanceAfter === null ? null : tx.occurredAt,
    ],
  );
}

// ---------------------------------------------------------------- queries ---

export async function listTransactions(
  range: DateRange,
  filters: { bankId?: string; accountId?: string; category?: string; direction?: string } = {},
  limit = 500,
): Promise<Transaction[]> {
  const where = ['occurred_at BETWEEN ? AND ?'];
  const params: Scalar[] = [range.from, range.to];

  if (filters.bankId) { where.push('bank_id = ?'); params.push(filters.bankId); }
  if (filters.accountId) { where.push('account_id = ?'); params.push(filters.accountId); }
  if (filters.category) { where.push('category = ?'); params.push(filters.category); }
  if (filters.direction) { where.push('direction = ?'); params.push(filters.direction); }

  params.push(limit);
  const r = await db().execute(
    `SELECT * FROM transactions WHERE ${where.join(' AND ')}
      ORDER BY occurred_at DESC LIMIT ?`,
    params,
  );
  return r.rows.map(mapRow);
}

export interface Totals {
  debit: number;
  credit: number;
  count: number;
}

export async function totalsForRange(range: DateRange, bankId?: string): Promise<Totals> {
  const params: Scalar[] = [range.from, range.to];
  let sql = `SELECT direction, SUM(amount) AS total, COUNT(*) AS n
               FROM transactions WHERE occurred_at BETWEEN ? AND ?`;
  if (bankId) { sql += ' AND bank_id = ?'; params.push(bankId); }
  sql += ' GROUP BY direction';

  const r = await db().execute(sql, params);
  const totals: Totals = { debit: 0, credit: 0, count: 0 };
  for (const row of r.rows) {
    const total = Number(row.total ?? 0);
    totals.count += Number(row.n ?? 0);
    if (row.direction === 'debit') totals.debit = total;
    else totals.credit = total;
  }
  return totals;
}

export interface Slice {
  key: string;
  label: string;
  debit: number;
  credit: number;
  count: number;
}

export async function spendByCategory(range: DateRange, bankId?: string): Promise<Slice[]> {
  const params: Scalar[] = [range.from, range.to];
  let sql = `SELECT category AS key, SUM(amount) AS debit, COUNT(*) AS n
               FROM transactions
              WHERE direction = 'debit' AND occurred_at BETWEEN ? AND ?`;
  if (bankId) { sql += ' AND bank_id = ?'; params.push(bankId); }
  sql += ' GROUP BY category ORDER BY debit DESC';

  const r = await db().execute(sql, params);
  return r.rows.map(row => ({
    key: String(row.key),
    label: String(row.key),
    debit: Number(row.debit ?? 0),
    credit: 0,
    count: Number(row.n ?? 0),
  }));
}

export async function spendByBank(range: DateRange): Promise<Slice[]> {
  const r = await db().execute(
    `SELECT bank_id AS key,
            SUM(CASE WHEN direction = 'debit'  THEN amount ELSE 0 END) AS debit,
            SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS credit,
            COUNT(*) AS n
       FROM transactions WHERE occurred_at BETWEEN ? AND ?
      GROUP BY bank_id ORDER BY debit DESC`,
    [range.from, range.to],
  );
  return r.rows.map(row => ({
    key: String(row.key),
    label: bankById.get(String(row.key))?.shortName ?? String(row.key),
    debit: Number(row.debit ?? 0),
    credit: Number(row.credit ?? 0),
    count: Number(row.n ?? 0),
  }));
}

export async function topMerchants(range: DateRange, limit = 8): Promise<Slice[]> {
  const r = await db().execute(
    `SELECT COALESCE(merchant, 'Unknown') AS key, SUM(amount) AS debit, COUNT(*) AS n
       FROM transactions
      WHERE direction = 'debit' AND occurred_at BETWEEN ? AND ?
      GROUP BY key ORDER BY debit DESC LIMIT ?`,
    [range.from, range.to, limit],
  );
  return r.rows.map(row => ({
    key: String(row.key), label: String(row.key),
    debit: Number(row.debit ?? 0), credit: 0, count: Number(row.n ?? 0),
  }));
}

/** Daily debit totals across the range, used by the trend chart. */
export async function dailySpend(range: DateRange, bankId?: string): Promise<Array<{ day: number; debit: number }>> {
  const params: Scalar[] = [range.from, range.to];
  let sql = `SELECT occurred_at, amount FROM transactions
              WHERE direction = 'debit' AND occurred_at BETWEEN ? AND ?`;
  if (bankId) { sql += ' AND bank_id = ?'; params.push(bankId); }

  const r = await db().execute(sql, params);
  const buckets = new Map<number, number>();
  for (const row of r.rows) {
    const d = new Date(Number(row.occurred_at));
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    buckets.set(day, (buckets.get(day) ?? 0) + Number(row.amount));
  }
  return [...buckets.entries()]
    .map(([day, debit]) => ({ day, debit }))
    .sort((a, b) => a.day - b.day);
}

export async function listAccounts(): Promise<Account[]> {
  const r = await db().execute(
    'SELECT * FROM accounts WHERE archived = 0 ORDER BY bank_id, instrument',
  );
  return r.rows.map(row => ({
    id: String(row.id),
    bankId: String(row.bank_id),
    last4: row.last4 == null ? null : String(row.last4),
    instrument: String(row.instrument) as Account['instrument'],
    label: String(row.label),
    creditLimit: row.credit_limit == null ? null : Number(row.credit_limit),
    lastBalance: row.last_balance == null ? null : Number(row.last_balance),
    lastBalanceAt: row.last_balance_at == null ? null : Number(row.last_balance_at),
    archived: false,
  }));
}

export async function setAccountCreditLimit(id: string, limitMinor: number | null): Promise<void> {
  await db().execute('UPDATE accounts SET credit_limit = ? WHERE id = ?', [limitMinor, id]);
}

/**
 * Records a user's category correction and back-applies it to every matching
 * row, so fixing "SWIGGY" once fixes it everywhere, past and future.
 */
export async function setCategory(txId: string, category: string): Promise<void> {
  const handle = db();
  const r = await handle.execute('SELECT merchant FROM transactions WHERE id = ?', [txId]);
  const merchant = r.rows[0]?.merchant;

  await handle.execute(
    'UPDATE transactions SET category = ?, category_locked = 1 WHERE id = ?',
    [category, txId],
  );

  if (merchant == null) return;

  await handle.execute(
    `INSERT INTO category_rules (id, match_field, match_value, category, created_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(match_field, match_value) DO UPDATE SET category = excluded.category`,
    [`merchant:${merchant}`, 'merchant', String(merchant), category, Date.now()],
  );

  await handle.execute(
    'UPDATE transactions SET category = ? WHERE merchant = ? AND category_locked = 0',
    [category, String(merchant)],
  );
}

function mapRow(row: Record<string, Scalar>): Transaction {
  return {
    id: String(row.id),
    bankId: String(row.bank_id),
    last4: row.last4 == null ? null : String(row.last4),
    instrument: String(row.instrument) as Transaction['instrument'],
    direction: String(row.direction) as Transaction['direction'],
    amount: Number(row.amount),
    currency: String(row.currency),
    occurredAt: Number(row.occurred_at),
    merchantRaw: row.merchant_raw == null ? null : String(row.merchant_raw),
    merchant: row.merchant == null ? null : String(row.merchant),
    category: String(row.category),
    channel: String(row.channel) as Transaction['channel'],
    refNo: row.ref_no == null ? null : String(row.ref_no),
    balanceAfter: row.balance_after == null ? null : Number(row.balance_after),
    source: String(row.source) as Transaction['source'],
    sourceId: String(row.source_id),
    sender: String(row.sender),
    templateId: String(row.template_id),
    confidence: Number(row.confidence),
    categoryLocked: Number(row.category_locked) === 1,
    createdAt: Number(row.created_at),
  };
}
