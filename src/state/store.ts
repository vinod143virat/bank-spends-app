import { create } from 'zustand';
import { initDatabase } from '../db';
import {
  dailySpend, listAccounts, listTransactions, spendByBank, spendByCategory,
  topMerchants, totalsForRange, type Slice, type Totals,
} from '../db/transactions';
import type { Account, DateRange, RangePreset, Transaction } from '../domain/types';
import { deriveInsights, type Insight } from '../features/insights/engine';
import { precedingRange, rangeFor, trailingRange } from '../lib/ranges';
import { hasSmsPermission, requestSmsPermission, syncSms, type SmsSyncResult } from '../ingest/sms/sync';

export type SyncPhase = 'idle' | 'syncing' | 'done' | 'error';

interface AppState {
  ready: boolean;
  preset: RangePreset;
  range: DateRange;
  bankFilter: string | null;

  totals: Totals;
  byCategory: Slice[];
  byBank: Slice[];
  merchants: Slice[];
  trend: Array<{ day: number; debit: number }>;
  recent: Transaction[];
  accounts: Account[];
  insights: Insight[];

  smsGranted: boolean;
  syncPhase: SyncPhase;
  lastSync: SmsSyncResult | null;
  error: string | null;

  bootstrap: () => Promise<void>;
  setPreset: (preset: RangePreset) => Promise<void>;
  setBankFilter: (bankId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  grantSms: () => Promise<void>;
  runSync: () => Promise<void>;
}

const EMPTY_TOTALS: Totals = { debit: 0, credit: 0, count: 0 };

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  preset: 'this_month',
  range: rangeFor('this_month'),
  bankFilter: null,

  totals: EMPTY_TOTALS,
  byCategory: [],
  byBank: [],
  merchants: [],
  trend: [],
  recent: [],
  accounts: [],
  insights: [],

  smsGranted: false,
  syncPhase: 'idle',
  lastSync: null,
  error: null,

  bootstrap: async () => {
    try {
      await initDatabase();
      set({ ready: true, smsGranted: hasSmsPermission() });
      await get().refresh();
      if (get().smsGranted) {
        await get().runSync();
      }
    } catch (e) {
      set({ ready: true, error: describe(e) });
    }
  },

  setPreset: async preset => {
    set({ preset, range: rangeFor(preset) });
    await get().refresh();
  },

  setBankFilter: async bankId => {
    set({ bankFilter: bankId });
    await get().refresh();
  },

  refresh: async () => {
    const { range, bankFilter } = get();
    try {
      const bank = bankFilter ?? undefined;
      const previous = precedingRange(range);
      const baselineRange = trailingRange(90);

      const [
        totals, byCategory, byBank, merchants, trend, recent, accounts,
        currentTxs, previousTxs, baselineTxs,
      ] = await Promise.all([
        totalsForRange(range, bank),
        spendByCategory(range, bank),
        spendByBank(range),
        topMerchants(range),
        dailySpend(range, bank),
        listTransactions(range, { bankId: bank }, 100),
        listAccounts(),
        listTransactions(range, { bankId: bank }, 2000),
        listTransactions(previous, { bankId: bank }, 2000),
        listTransactions(baselineRange, {}, 4000),
      ]);

      set({
        totals, byCategory, byBank, merchants, trend, recent, accounts,
        insights: deriveInsights({
          range, current: currentTxs, previous: previousTxs,
          accounts, baseline: baselineTxs,
        }),
        error: null,
      });
    } catch (e) {
      set({ error: describe(e) });
    }
  },

  grantSms: async () => {
    const granted = await requestSmsPermission();
    set({ smsGranted: granted });
    if (granted) await get().runSync();
  },

  runSync: async () => {
    if (get().syncPhase === 'syncing') return;
    set({ syncPhase: 'syncing', error: null });
    try {
      const result = await syncSms();
      set({ syncPhase: 'done', lastSync: result });
      await get().refresh();
    } catch (e) {
      set({ syncPhase: 'error', error: describe(e) });
    }
  },
}));

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
