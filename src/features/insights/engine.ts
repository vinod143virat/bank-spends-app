import { bankById } from '../../domain/banks';
import { formatMinor } from '../../domain/money';
import type { Account, DateRange, Transaction } from '../../domain/types';

export type RiskLevel = 'high' | 'medium' | 'low';

export interface Insight {
  id: string;
  level: RiskLevel;
  title: string;
  detail: string;
  /** Category or account the insight is about, for deep-linking. */
  contextKey?: string;
}

export interface InsightInput {
  range: DateRange;
  current: Transaction[];
  /** The equivalent window immediately before `range`, for pace comparison. */
  previous: Transaction[];
  accounts: Account[];
  /** 90 days of history, used for the outlier baseline. */
  baseline: Transaction[];
}

const DAY_MS = 86_400_000;

/**
 * Derives the "risks" surface. Everything here is a rule with an explicit
 * threshold rather than a score: a user acting on money needs to know exactly
 * why the app flagged something.
 */
export function deriveInsights(input: InsightInput): Insight[] {
  return [
    ...creditUtilisation(input),
    ...spendPace(input),
    ...largeOutliers(input),
    ...subscriptionCreep(input),
    ...lowBalance(input),
    ...feeCharges(input),
  ].sort((a, b) => rank(b.level) - rank(a.level));
}

/** Utilisation above 30% is the threshold credit bureaus start penalising. */
function creditUtilisation({ accounts, current }: InsightInput): Insight[] {
  const out: Insight[] = [];

  for (const account of accounts) {
    if (account.instrument !== 'credit_card' || !account.creditLimit) continue;

    const spent = current
      .filter(t => t.direction === 'debit' && t.last4 === account.last4 && t.instrument === 'credit_card')
      .reduce((sum, t) => sum + t.amount, 0);

    const pct = Math.round((spent / account.creditLimit) * 100);
    if (pct < 30) continue;

    out.push({
      id: `util:${account.id}`,
      level: pct >= 70 ? 'high' : 'medium',
      title: `${account.label} is at ${pct}% utilisation`,
      detail:
        `${formatMinor(spent)} of a ${formatMinor(account.creditLimit)} limit. ` +
        'Staying under 30% before the statement date protects your credit score.',
      contextKey: account.id,
    });
  }
  return out;
}

/**
 * Compares spend so far against the same elapsed fraction of the previous
 * window, so a half-finished month is not judged against a complete one.
 */
function spendPace({ range, current, previous }: InsightInput): Insight[] {
  const spent = sumDebits(current);
  const prior = sumDebits(previous);
  if (prior === 0 || spent === 0) return [];

  const elapsed = Math.min(1, (Date.now() - range.from) / (range.to - range.from));
  if (elapsed < 0.15) return []; // too early to say anything useful

  const comparable = prior * elapsed;
  if (comparable === 0) return [];

  const deltaPct = Math.round(((spent - comparable) / comparable) * 100);
  if (deltaPct < 20) return [];

  const projected = Math.round(spent / elapsed);
  return [{
    id: 'pace',
    level: deltaPct >= 50 ? 'high' : 'medium',
    title: `Spending ${deltaPct}% faster than last period`,
    detail:
      `${formatMinor(spent)} so far versus ${formatMinor(Math.round(comparable))} at the ` +
      `same point last period. On this pace you will finish around ${formatMinor(projected)}.`,
  }];
}

/**
 * Flags a debit far above what this merchant usually costs. The baseline needs
 * at least three prior payments, otherwise "unusual" is just "new".
 */
function largeOutliers({ current, baseline }: InsightInput): Insight[] {
  const history = new Map<string, number[]>();
  for (const tx of baseline) {
    if (tx.direction !== 'debit' || !tx.merchant) continue;
    const list = history.get(tx.merchant) ?? [];
    list.push(tx.amount);
    history.set(tx.merchant, list);
  }

  const out: Insight[] = [];
  const seen = new Set<string>();

  for (const tx of current) {
    if (tx.direction !== 'debit' || !tx.merchant || seen.has(tx.merchant)) continue;

    const amounts = history.get(tx.merchant);
    if (!amounts || amounts.length < 3) continue;

    const median = percentile(amounts, 0.5);
    if (median === 0 || tx.amount < median * 3) continue;

    seen.add(tx.merchant);
    out.push({
      id: `outlier:${tx.id}`,
      level: 'medium',
      title: `Unusually large payment to ${tx.merchant}`,
      detail:
        `${formatMinor(tx.amount)} against a usual ${formatMinor(Math.round(median))}. ` +
        'Worth confirming this was intentional.',
      contextKey: tx.merchant,
    });
  }
  return out.slice(0, 3);
}

/**
 * Detects recurring charges: the same merchant billing a near-identical amount
 * on a roughly monthly cadence. Three occurrences is the minimum that
 * distinguishes a subscription from a coincidence.
 */
function subscriptionCreep({ baseline }: InsightInput): Insight[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of baseline) {
    if (tx.direction !== 'debit' || !tx.merchant) continue;
    const list = groups.get(tx.merchant) ?? [];
    list.push(tx);
    groups.set(tx.merchant, list);
  }

  let monthlyTotal = 0;
  const names: string[] = [];

  for (const [merchant, txs] of groups) {
    if (txs.length < 3) continue;
    const sorted = [...txs].sort((a, b) => a.occurredAt - b.occurredAt);

    const amountsAgree = sorted.every(
      t => Math.abs(t.amount - sorted[0].amount) <= sorted[0].amount * 0.05,
    );
    if (!amountsAgree) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].occurredAt - sorted[i - 1].occurredAt) / DAY_MS);
    }
    const monthly = gaps.every(g => g >= 25 && g <= 35);
    if (!monthly) continue;

    monthlyTotal += sorted[0].amount;
    names.push(merchant);
  }

  if (names.length === 0) return [];

  return [{
    id: 'subscriptions',
    level: 'low',
    title: `${names.length} recurring ${names.length === 1 ? 'charge' : 'charges'}, ${formatMinor(monthlyTotal)} a month`,
    detail: `${names.slice(0, 4).join(', ')}${names.length > 4 ? ` and ${names.length - 4} more` : ''}. That is ${formatMinor(monthlyTotal * 12)} a year.`,
  }];
}

/** A balance that will not cover the coming week at the current burn rate. */
function lowBalance({ accounts, current, range }: InsightInput): Insight[] {
  const out: Insight[] = [];
  const days = Math.max(1, (Math.min(Date.now(), range.to) - range.from) / DAY_MS);

  for (const account of accounts) {
    if (account.instrument !== 'account' || account.lastBalance === null) continue;
    if (account.lastBalanceAt === null || Date.now() - account.lastBalanceAt > 7 * DAY_MS) {
      continue; // balance too stale to reason about
    }

    const spent = current
      .filter(t => t.direction === 'debit' && t.last4 === account.last4)
      .reduce((sum, t) => sum + t.amount, 0);
    if (spent === 0) continue;

    const perDay = spent / days;
    const runway = account.lastBalance / perDay;
    if (runway > 7) continue;

    out.push({
      id: `runway:${account.id}`,
      level: runway <= 3 ? 'high' : 'medium',
      title: `${account.label} has about ${Math.floor(runway)} days of runway`,
      detail:
        `${formatMinor(account.lastBalance)} left against ${formatMinor(Math.round(perDay))} ` +
        'of daily spend in this period.',
      contextKey: account.id,
    });
  }
  return out;
}

function feeCharges({ current }: InsightInput): Insight[] {
  const fees = current.filter(t => t.direction === 'debit' && t.category === 'Fees & Charges');
  if (fees.length === 0) return [];

  const total = sumDebits(fees);
  const banks = [...new Set(fees.map(f => bankById.get(f.bankId)?.shortName ?? f.bankId))];

  return [{
    id: 'fees',
    level: total > 100000 ? 'medium' : 'low',
    title: `${formatMinor(total)} in fees and charges`,
    detail: `${fees.length} ${fees.length === 1 ? 'charge' : 'charges'} from ${banks.join(', ')}. Most are refundable if disputed promptly.`,
    contextKey: 'Fees & Charges',
  }];
}

function sumDebits(txs: Transaction[]): number {
  return txs.reduce((sum, t) => (t.direction === 'debit' ? sum + t.amount : sum), 0);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * p);
  return sorted[index] ?? 0;
}

function rank(level: RiskLevel): number {
  return level === 'high' ? 3 : level === 'medium' ? 2 : 1;
}
