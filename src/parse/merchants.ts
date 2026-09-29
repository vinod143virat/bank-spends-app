/**
 * Merchant strings arrive as payment-rail debris:
 *   "UPI/P2M/509712345/SWIGGY"   "swiggy@ybl"   "POS 4517*1234 AMAZON IN"
 *   "NEFT-HDFC0000123-ACME PVT LTD"
 * Normalisation strips the rail, leaving something a human recognises, which is
 * also what the category dictionary matches against.
 */

export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Transport',
  'Bills & Utilities',
  'Entertainment',
  'Health',
  'Travel',
  'Education',
  'Rent',
  'Investments',
  'Transfers',
  'Income',
  'Cash',
  'Fees & Charges',
  'Uncategorised',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Rail prefixes to peel off before anything else. */
const RAIL_PREFIXES = [
  /^UPI[/-](?:P2M|P2A|P2P)?[/-]?/i,
  /^(?:POS|ECOM|ATM|NEFT|IMPS|RTGS|ACH|MMT|MPS|INF|BIL|CMS)[/\-\s]+/i,
  /^(?:DR|CR)[/\-\s]+/i,
];

const KEYWORD_CATEGORIES: Array<[RegExp, Category]> = [
  [/swiggy|zomato|dominos|mcdonald|kfc|burger|pizza|starbucks|cafe|restaurant|eatsure|dunzo\s*food/i, 'Food & Dining'],
  [/bigbasket|blinkit|zepto|dmart|grofers|instamart|reliance\s*fresh|more\s*retail|spencer/i, 'Groceries'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|snapdeal|tatacliq|shop|store|retail|lifestyle|westside/i, 'Shopping'],
  [/uber|ola|rapido|namma\s*yatri|metro|irctc|redbus|petrol|fuel|hpcl|iocl|bpcl|shell|fastag|parking/i, 'Transport'],
  [/airtel|jio|vodafone|\bvi\b|bsnl|tata\s*power|adani\s*electricity|bescom|mseb|torrent\s*power|gas|broadband|electricity|water\s*bill|recharge|postpaid|prepaid/i, 'Bills & Utilities'],
  [/netflix|prime\s*video|hotstar|spotify|youtube|sony\s*liv|zee5|bookmyshow|pvr|inox|jiocinema/i, 'Entertainment'],
  [/apollo|pharmeasy|1mg|netmeds|medplus|hospital|clinic|diagnostic|lab|practo|cult\.?fit|pharmacy/i, 'Health'],
  [/makemytrip|goibibo|cleartrip|yatra|indigo|vistara|air\s*india|spicejet|oyo|airbnb|booking\.com|hotel|travel/i, 'Travel'],
  [/byju|unacademy|vedantu|coursera|udemy|school|college|university|tuition|academy/i, 'Education'],
  [/\brent\b|nobroker|rentpay|housing/i, 'Rent'],
  [/zerodha|groww|upstox|kuvera|coin|mutual\s*fund|\bsip\b|nps\b|ppf\b|smallcase|angel\s*one/i, 'Investments'],
  [/salary|payroll|stipend|dividend|interest\s*credit|cashback|refund/i, 'Income'],
  [/\batm\b|cash\s*withdrawal|cash\s*wdl/i, 'Cash'],
  [/charge|fee|penalty|gst|annual\s*maintenance|\bamc\b|late\s*payment|surcharge/i, 'Fees & Charges'],
];

export function normalizeMerchant(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();

  for (const prefix of RAIL_PREFIXES) {
    s = s.replace(prefix, '');
  }

  // A VPA ("swiggy@ybl", "9876543210@paytm") carries the handle in front of @.
  const vpa = s.match(/^([A-Za-z0-9._-]+)@[A-Za-z]+$/);
  if (vpa) {
    s = vpa[1];
    // A bare phone number as a VPA tells us nothing useful.
    if (/^\d{10,}$/.test(s)) return null;
  }

  // Drop trailing reference numbers and rail ids left behind by the peel.
  s = s.replace(/[/\-\s]+\d{6,}$/g, '');
  s = s.replace(/^\d{6,}[/\-\s]+/g, '');
  // Drop masked card/account fragments: "4517*1234", "XXXX1234", "451712345678".
  // Any 6+ character token built only from digits and masking characters is a
  // rail identifier, never a merchant name.
  s = s.replace(/\b[\dxX*#]{6,}\b/g, ' ');
  s = s.replace(/[_/]+/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/[.,;:-]+$/, '').trim();

  if (!s || /^\d+$/.test(s)) return null;

  return toTitleCase(s);
}

export function categorize(
  merchant: string | null,
  rawBody: string,
  direction: 'debit' | 'credit',
): Category {
  const haystack = `${merchant ?? ''} ${rawBody}`;

  for (const [pattern, category] of KEYWORD_CATEGORIES) {
    if (pattern.test(haystack)) {
      // "refund" maps to Income, but only a credit actually is income.
      if (category === 'Income' && direction === 'debit') continue;
      return category;
    }
  }

  if (direction === 'credit') return 'Transfers';
  return 'Uncategorised';
}

function toTitleCase(s: string): string {
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    return s
      .toLowerCase()
      .split(/\s+/)
      .map(w => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
      .join(' ');
  }
  return s;
}
