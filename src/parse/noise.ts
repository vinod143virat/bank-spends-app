/**
 * Bank senders push far more non-transactional traffic than transactional:
 * OTPs, marketing, balance replies, mandate pre-notifications. Letting any of
 * it through inflates every number on the dashboard, so the filter runs before
 * template matching and is deliberately aggressive.
 */

/** Never a transaction, whatever else the message says. */
const ALWAYS_BLOCK = [
  /\botp\b/i,
  /one[\s-]?time\s+password/i,
  /do\s+not\s+share/i,
  /never\s+share/i,
  /\bverification\s+code\b/i,
  /\b(?:pre-?approved|apply\s+now|offer\s+valid|click\s+here|t&c\s+apply)\b/i,
  /\bloan\s+offer\b/i,
];

/**
 * Money has not moved (yet). These are blocked unless the message is also a
 * reversal or refund, which genuinely does move money back.
 */
const NO_MONEY_MOVED = [
  /\bwill\s+be\s+(?:debited|deducted|charged)\b/i,
  /\bis\s+due\s+(?:on|for)\b/i,
  /\bdue\s+date\b/i,
  /\bscheduled\s+(?:for|on)\b/i,
  /\b(?:declined|failed|unsuccessful|could\s+not\s+be\s+processed)\b/i,
  /\binsufficient\s+(?:funds|balance)\b/i,
  /\bavailable\s+balance\s+in\s+your/i,
  /\bis\s+your\s+(?:available\s+)?balance\b/i,
];

const MONEY_MOVED_BACK = [/\breversed\b/i, /\brefund(?:ed)?\b/i, /\bcredited\s+back\b/i];

export function isNonTransactional(body: string): boolean {
  if (ALWAYS_BLOCK.some(r => r.test(body))) {
    return true;
  }
  if (MONEY_MOVED_BACK.some(r => r.test(body))) {
    return false;
  }
  return NO_MONEY_MOVED.some(r => r.test(body));
}
