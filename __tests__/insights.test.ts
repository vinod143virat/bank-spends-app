import { deriveInsights } from '../src/features/insights/engine';
import type { Account, Transaction } from '../src/domain/types';

const DAY = 86_400_000;
const NOW = Date.now();

let seq = 0;
function tx(over: Partial<Transaction> = {}): Transaction {
  seq++;
  return {
    id: `t${seq}`, bankId: 'hdfc', last4: '1234', instrument: 'account',
    direction: 'debit', amount: 10000, currency: 'INR', occurredAt: NOW - DAY,
    merchantRaw: null, merchant: 'Swiggy', category: 'Food & Dining',
    channel: 'upi', refNo: null, balanceAfter: null, source: 'sms',
    sourceId: `s${seq}`, sender: 'VM-HDFCBK', templateId: 'hdfc.upi.debit',
    confidence: 0.97, categoryLocked: false, createdAt: NOW,
    ...over,
  };
}

function account(over: Partial<Account> = {}): Account {
  return {
    id: 'hdfc:credit_card:4567', bankId: 'hdfc', last4: '4567',
    instrument: 'credit_card', label: 'HDFC •4567', creditLimit: 10_000_00,
    lastBalance: null, lastBalanceAt: null, archived: false,
    ...over,
  };
}

/** A window that is exactly half elapsed, so pace maths is predictable. */
const range = { from: NOW - 10 * DAY, to: NOW + 10 * DAY, label: 'test' };

function run(input: Partial<Parameters<typeof deriveInsights>[0]>) {
  return deriveInsights({
    range, current: [], previous: [], accounts: [], baseline: [], ...input,
  });
}

describe('credit utilisation', () => {
  it('stays quiet below the 30% threshold', () => {
    const insights = run({
      accounts: [account()],
      current: [tx({ amount: 200_00, instrument: 'credit_card', last4: '4567' })],
    });
    expect(insights.find(i => i.id.startsWith('util:'))).toBeUndefined();
  });

  it('escalates to high past 70%', () => {
    const insights = run({
      accounts: [account()],
      current: [tx({ amount: 8_000_00, instrument: 'credit_card', last4: '4567' })],
    });
    const util = insights.find(i => i.id.startsWith('util:'));
    expect(util).toBeDefined();
    expect(util!.level).toBe('high');
    expect(util!.title).toContain('80%');
  });

  it('says nothing when no limit has been entered', () => {
    const insights = run({
      accounts: [account({ creditLimit: null })],
      current: [tx({ amount: 9_000_00, instrument: 'credit_card', last4: '4567' })],
    });
    expect(insights.find(i => i.id.startsWith('util:'))).toBeUndefined();
  });
});

describe('spend pace', () => {
  it('compares against the elapsed fraction, not the whole prior window', () => {
    // Half the window has elapsed. Prior period total 1000, so the comparable
    // figure is 500. Spending 800 is 60% ahead.
    const insights = run({
      current: [tx({ amount: 800_00 })],
      previous: [tx({ amount: 1000_00 })],
    });
    const pace = insights.find(i => i.id === 'pace');
    expect(pace).toBeDefined();
    expect(pace!.level).toBe('high');
    expect(pace!.title).toContain('60%');
  });

  it('does not flag spending that is merely in line', () => {
    const insights = run({
      current: [tx({ amount: 520_00 })],
      previous: [tx({ amount: 1000_00 })],
    });
    expect(insights.find(i => i.id === 'pace')).toBeUndefined();
  });
});

describe('outliers', () => {
  it('needs a baseline before calling anything unusual', () => {
    const insights = run({
      current: [tx({ amount: 5000_00 })],
      baseline: [tx({ amount: 100_00 }), tx({ amount: 100_00 })],
    });
    expect(insights.find(i => i.id.startsWith('outlier:'))).toBeUndefined();
  });

  it('flags a payment far above the merchant median', () => {
    const insights = run({
      current: [tx({ amount: 5000_00 })],
      baseline: [tx({ amount: 100_00 }), tx({ amount: 120_00 }), tx({ amount: 110_00 })],
    });
    expect(insights.find(i => i.id.startsWith('outlier:'))).toBeDefined();
  });
});

describe('subscriptions', () => {
  it('detects a steady monthly charge', () => {
    const baseline = [0, 30, 60].map(days =>
      tx({ merchant: 'Netflix', amount: 499_00, occurredAt: NOW - days * DAY }),
    );
    const found = run({ baseline }).find(i => i.id === 'subscriptions');
    expect(found).toBeDefined();
    expect(found!.title).toContain('1 recurring charge');
  });

  it('ignores a merchant billed at irregular intervals', () => {
    const baseline = [0, 3, 40].map(days =>
      tx({ merchant: 'Swiggy', amount: 499_00, occurredAt: NOW - days * DAY }),
    );
    expect(run({ baseline }).find(i => i.id === 'subscriptions')).toBeUndefined();
  });
});

describe('ordering', () => {
  it('puts the most severe insight first', () => {
    const insights = run({
      accounts: [account()],
      current: [tx({ amount: 9_000_00, instrument: 'credit_card', last4: '4567' })],
      baseline: [0, 30, 60].map(days =>
        tx({ merchant: 'Netflix', amount: 499_00, occurredAt: NOW - days * DAY }),
      ),
    });
    expect(insights.length).toBeGreaterThan(1);
    expect(insights[0].level).toBe('high');
    expect(insights[insights.length - 1].level).toBe('low');
  });
});
