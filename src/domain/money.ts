/** Minor-unit money helpers. All amounts in this app are integers. */

const MINOR_PER_MAJOR = 100;

/** "1,234.50" | "1234.5" | "1234" -> 123450 */
export function parseAmountToMinor(raw: string): number | null {
  const cleaned = raw.replace(/[,\s ]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const [major, minor = ''] = cleaned.split('.');
  const paddedMinor = (minor + '00').slice(0, 2);
  return Number(major) * MINOR_PER_MAJOR + Number(paddedMinor);
}

export function formatMinor(minor: number, currency = 'INR'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const major = Math.floor(abs / MINOR_PER_MAJOR);
  const rest = abs % MINOR_PER_MAJOR;
  const symbol = currency === 'INR' ? '₹' : '';
  return `${sign}${symbol}${groupIndian(major)}.${String(rest).padStart(2, '0')}`;
}

/** Compact form for tiles: ₹1.2L, ₹45.3K, ₹980 */
export function formatMinorCompact(minor: number, currency = 'INR'): string {
  const abs = Math.abs(minor);
  const major = abs / MINOR_PER_MAJOR;
  const sign = minor < 0 ? '-' : '';
  const symbol = currency === 'INR' ? '₹' : '';
  if (major >= 1e7) return `${sign}${symbol}${(major / 1e7).toFixed(2)}Cr`;
  if (major >= 1e5) return `${sign}${symbol}${(major / 1e5).toFixed(2)}L`;
  if (major >= 1000) return `${sign}${symbol}${(major / 1000).toFixed(1)}K`;
  return `${sign}${symbol}${Math.round(major)}`;
}

/** Indian digit grouping: 12,34,567 */
function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const head = s.slice(0, -3);
  const tail = s.slice(-3);
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail;
}
