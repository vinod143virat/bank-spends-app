import type { Channel, Direction, Instrument } from '../domain/types';

export interface TemplateMatch {
  amount: string;
  last4?: string;
  merchant?: string;
  date?: string;
  ref?: string;
  balance?: string;
}

export interface Template {
  /** Stable id, stored on every row so a bad template can be traced and re-run. */
  id: string;
  /** null means "any bank" — used by the low-confidence generic fallbacks. */
  bankId: string | null;
  direction: Direction;
  channel: Channel;
  instrument: Instrument;
  /** Must use named groups drawn from TemplateMatch. */
  pattern: RegExp;
  /** 0..1. Bank-specific templates score high; generic fallbacks score low. */
  confidence: number;
}

export interface RawMessage {
  /** Provider-scoped unique id: SMS `_id`, or Gmail message id. */
  sourceId: string;
  source: 'sms' | 'email';
  sender: string;
  body: string;
  receivedAt: number;
}
