import { DeviceEventEmitter, PermissionsAndroid } from 'react-native';
import { BANKS } from '../../domain/banks';
import { getState, setState } from '../../db';
import { ingestTransactions, type IngestOutcome } from '../../db/transactions';
import { parseMessage } from '../../parse/engine';
import type { RawMessage } from '../../parse/types';
import type { ParsedTransaction } from '../../domain/types';
import NativeSmsReader from '../../native/NativeSmsReader';

const CURSOR_KEY = 'sms.cursor';
const PAGE_SIZE = 500;
/** How far back the very first sync reaches. */
const BACKFILL_DAYS = 180;
/**
 * The cursor rewinds slightly on each run so a message that arrived while the
 * previous page was being read is not stepped over. Re-reading is free: the
 * transaction ids are deterministic, so a repeat lands as a no-op.
 */
const CURSOR_OVERLAP_MS = 60_000;

const SENDER_FRAGMENTS = BANKS.flatMap(b => b.smsSenders);

export interface SmsSyncResult extends IngestOutcome {
  messagesRead: number;
  unparsed: number;
  /** Bodies the parser could not handle, kept in memory only, for the debug screen. */
  samples: Array<{ sender: string; body: string; reason: string }>;
}

export function hasSmsPermission(): boolean {
  try {
    return NativeSmsReader.hasReadPermission();
  } catch {
    return false;
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);
  return granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;
}

export async function syncSms(): Promise<SmsSyncResult> {
  const result: SmsSyncResult = {
    inserted: 0, merged: 0, skipped: 0, messagesRead: 0, unparsed: 0, samples: [],
  };

  if (!hasSmsPermission()) return result;

  const stored = await getState(CURSOR_KEY);
  let cursor = stored
    ? Math.max(0, Number(stored) - CURSOR_OVERLAP_MS)
    : Date.now() - BACKFILL_DAYS * 86_400_000;

  // Pages forward until the provider runs dry, so a first-run backfill of
  // several thousand alerts completes in one sync rather than one page per open.
  for (;;) {
    const rows = await NativeSmsReader.query(cursor, PAGE_SIZE, SENDER_FRAGMENTS);
    if (rows.length === 0) break;

    const parsed: ParsedTransaction[] = [];

    for (const row of rows) {
      result.messagesRead++;
      const message: RawMessage = {
        sourceId: row.id,
        source: 'sms',
        sender: row.address,
        body: row.body,
        receivedAt: row.date,
      };

      const { transaction, reason } = parseMessage(message);
      if (transaction) {
        parsed.push(transaction);
      } else {
        result.unparsed++;
        // Only the genuinely unexpected cases are worth showing; OTPs and
        // marketing are supposed to be dropped.
        if (reason === 'no_template_matched' && result.samples.length < 25) {
          result.samples.push({ sender: row.address, body: row.body, reason });
        }
      }
    }

    const outcome = await ingestTransactions(parsed);
    result.inserted += outcome.inserted;
    result.merged += outcome.merged;
    result.skipped += outcome.skipped;

    cursor = rows[rows.length - 1].date;
    await setState(CURSOR_KEY, String(cursor));

    if (rows.length < PAGE_SIZE) break;
  }

  return result;
}

/** Fires when a bank alert arrives while the app is running. */
export function onSmsReceived(handler: () => void): () => void {
  const sub = DeviceEventEmitter.addListener('bankspends:smsReceived', handler);
  return () => sub.remove();
}
