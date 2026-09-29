/**
 * Bank alerts print dates in a dozen shapes and usually omit the year century,
 * the timezone, or both. Rather than trust them, we treat the message's own
 * received-at timestamp as authoritative (alerts land within seconds of the
 * transaction) and only fall back to the printed date when the two disagree by
 * more than a day — which happens for statement mails and backdated postings.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const DAY_MS = 86_400_000;

/**
 * Parses the date formats seen in Indian bank alerts:
 *   12/03/25, 12-03-2025, 12-Mar-25, 12Mar25, 2025-03-12:19:42:11,
 *   12-03-25 19:42:11, 12-03-2025, 01Mar25
 * Returns epoch ms in local time, or null when nothing recognisable is found.
 */
export function parseBankDate(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = raw.trim();

  // ISO-ish, optionally with a colon-joined time: 2025-03-12:19:42:11
  let m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[:T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    return build(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }

  // 12-Mar-25 / 12Mar25 / 12 Mar 2025
  m = s.match(
    /^(\d{1,2})[-\s]?([A-Za-z]{3})[A-Za-z]*[-\s,]?(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month === undefined) return null;
    return build(expandYear(+m[3]), month, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }

  // 12-03-25 / 12/03/2025, optionally followed by a time
  m = s.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    return build(
      expandYear(+m[3]), +m[2] - 1, +m[1],
      +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0),
    );
  }

  return null;
}

/**
 * Picks the timestamp to store. `receivedAt` wins unless the printed date is
 * more than a day away from it, which signals a statement or a backdated entry.
 */
export function resolveOccurredAt(printed: number | null, receivedAt: number): number {
  if (printed === null) return receivedAt;
  return Math.abs(printed - receivedAt) > DAY_MS ? printed : receivedAt;
}

function expandYear(y: number): number {
  if (y >= 1000) return y;
  // A two-digit year in a bank alert is always this century.
  return 2000 + y;
}

function build(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
): number | null {
  const d = new Date(year, month, day, hour, minute, second, 0);
  if (
    d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day
  ) {
    return null; // rejects things like 31-02-25
  }
  return d.getTime();
}
