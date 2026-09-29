import { parseMessage, transactionId } from '../src/parse/engine';
import { formatMinor, parseAmountToMinor } from '../src/domain/money';
import { normalizeMerchant, categorize } from '../src/parse/merchants';
import { parseBankDate } from '../src/parse/date';
import type { RawMessage } from '../src/parse/types';

const RECEIVED = new Date(2025, 2, 12, 19, 42, 30).getTime();

function sms(sender: string, body: string, receivedAt = RECEIVED): RawMessage {
  return { sourceId: 's1', source: 'sms', sender, body, receivedAt };
}

describe('money', () => {
  it('parses to minor units', () => {
    expect(parseAmountToMinor('1,234.50')).toBe(123450);
    expect(parseAmountToMinor('450.0')).toBe(45000);
    expect(parseAmountToMinor('1200')).toBe(120000);
    expect(parseAmountToMinor('0.05')).toBe(5);
  });

  it('rejects junk rather than guessing', () => {
    expect(parseAmountToMinor('12.345')).toBeNull();
    expect(parseAmountToMinor('abc')).toBeNull();
    expect(parseAmountToMinor('')).toBeNull();
  });

  it('formats with Indian digit grouping', () => {
    expect(formatMinor(123450)).toBe('₹1,234.50');
    expect(formatMinor(1234567890)).toBe('₹1,23,45,678.90');
    expect(formatMinor(5)).toBe('₹0.05');
  });
});

describe('dates', () => {
  it('handles the formats banks actually send', () => {
    expect(parseBankDate('12/03/25')).toBe(new Date(2025, 2, 12).getTime());
    expect(parseBankDate('12-Mar-25')).toBe(new Date(2025, 2, 12).getTime());
    expect(parseBankDate('12Mar25')).toBe(new Date(2025, 2, 12).getTime());
    expect(parseBankDate('2025-03-12:19:42:11')).toBe(
      new Date(2025, 2, 12, 19, 42, 11).getTime(),
    );
    expect(parseBankDate('12-03-25, 19:42:11')).toBe(
      new Date(2025, 2, 12, 19, 42, 11).getTime(),
    );
  });

  it('rejects impossible dates instead of rolling over', () => {
    expect(parseBankDate('31-02-25')).toBeNull();
  });
});

describe('HDFC', () => {
  it('parses a UPI debit', () => {
    const { transaction } = parseMessage(
      sms(
        'VM-HDFCBK',
        'Sent Rs.450.00 From HDFC Bank A/C x1234 To SWIGGY On 12/03/25 Ref 509712345678 Not You? Call 18002586161',
      ),
    );
    expect(transaction).toMatchObject({
      bankId: 'hdfc',
      direction: 'debit',
      amount: 45000,
      last4: '1234',
      merchant: 'Swiggy',
      category: 'Food & Dining',
      channel: 'upi',
      refNo: '509712345678',
    });
  });

  it('parses a credit card spend and keeps the instrument', () => {
    const { transaction } = parseMessage(
      sms(
        'AD-HDFCBK',
        'Spent Rs.1200.50 On HDFC Bank CREDIT Card xx4567 At AMAZON On 2025-03-12:19:42:11',
      ),
    );
    expect(transaction).toMatchObject({
      amount: 120050,
      instrument: 'credit_card',
      last4: '4567',
      merchant: 'Amazon',
      category: 'Shopping',
      direction: 'debit',
    });
  });

  it('parses an incoming credit', () => {
    const { transaction } = parseMessage(
      sms(
        'VM-HDFCBK',
        'Rs.50000.00 credited to HDFC Bank A/c xx1234 on 01-03-25 by a/c linked to VPA acme@ybl (UPI 509712345679)',
      ),
    );
    expect(transaction).toMatchObject({
      direction: 'credit',
      amount: 5000000,
      last4: '1234',
    });
  });
});

describe('ICICI / SBI / Axis / Kotak', () => {
  it('parses an ICICI UPI debit', () => {
    const { transaction } = parseMessage(
      sms(
        'VM-ICICIB',
        'Dear Customer, Acct XX123 debited with INR 500.00 on 12-Mar-25; SWIGGY credited. UPI:509712345678. Call 18002662 for dispute.',
      ),
    );
    expect(transaction).toMatchObject({
      bankId: 'icici',
      direction: 'debit',
      amount: 50000,
      merchant: 'Swiggy',
      refNo: '509712345678',
    });
  });

  it('parses an SBI UPI debit', () => {
    const { transaction } = parseMessage(
      sms(
        'JD-SBIUPI',
        'Dear UPI user A/C X1234 debited by 450.0 on date 12Mar25 trf to BIGBASKET Refno 509712345678. If not u? call 1800111109. -SBI',
      ),
    );
    expect(transaction).toMatchObject({
      bankId: 'sbi',
      direction: 'debit',
      amount: 45000,
      merchant: 'Bigbasket',
      category: 'Groceries',
    });
  });

  it('parses an Axis debit and captures the running balance', () => {
    const { transaction } = parseMessage(
      sms(
        'AD-AXISBK',
        'INR 450.00 debited from A/c no. XX1234 on 12-03-25, 19:42:11 IST. Info- UPI/P2M/509712345/UBER. Avl Bal- INR 12,345.67',
      ),
    );
    expect(transaction).toMatchObject({
      bankId: 'axis',
      amount: 45000,
      merchant: 'Uber',
      category: 'Transport',
      balanceAfter: 1234567,
    });
  });

  it('parses a Kotak UPI debit from a VPA', () => {
    const { transaction } = parseMessage(
      sms(
        'VM-KOTAKB',
        'Sent Rs.450.00 from Kotak Bank AC X1234 to swiggy@ybl on 12-03-25.UPI Ref 509712345678.',
      ),
    );
    expect(transaction).toMatchObject({
      bankId: 'kotak',
      amount: 45000,
      merchant: 'Swiggy',
    });
  });
});

describe('noise filtering', () => {
  const cases: Array<[string, string]> = [
    ['OTP', 'Your OTP for txn of Rs.4500 at AMAZON is 449281. Do not share it with anyone. -HDFC Bank'],
    ['mandate pre-notice', 'Rs.499.00 will be debited from your HDFC Bank A/c xx1234 on 15-03-25 towards NETFLIX mandate.'],
    ['declined', 'Your txn of Rs.2500 on HDFC Bank Card xx4567 at AMAZON was declined due to insufficient balance.'],
    ['marketing', 'You have a pre-approved loan offer of Rs.500000 on your HDFC Bank A/c xx1234. Apply now!'],
    ['balance reply', 'Available balance in your HDFC Bank A/c xx1234 is Rs.12,345.67 as on 12-03-25.'],
  ];

  it.each(cases)('drops %s', (_label, body) => {
    const result = parseMessage(sms('VM-HDFCBK', body));
    expect(result.transaction).toBeNull();
    expect(result.reason).toBe('non_transactional');
  });

  it('keeps a refund, which does move money', () => {
    const { transaction } = parseMessage(
      sms(
        'VM-HDFCBK',
        'Rs.1200.00 credited to HDFC Bank A/c xx1234 on 14-03-25 being refund from AMAZON.',
      ),
    );
    expect(transaction).toMatchObject({ direction: 'credit', amount: 120000 });
  });

  it('ignores senders that are not a known bank', () => {
    const result = parseMessage(
      sms('VM-ZOMATO', 'Rs.450 debited from A/c xx1234 for your order'),
    );
    expect(result.reason).toBe('unknown_sender');
  });
});

describe('merchant normalisation', () => {
  it.each([
    ['UPI/P2M/509712345/SWIGGY', 'Swiggy'],
    ['swiggy@ybl', 'Swiggy'],
    ['POS 4517*1234 AMAZON IN', 'Amazon IN'],
    ['NEFT-ACME PVT LTD', 'Acme Pvt Ltd'],
    ['9876543210@paytm', null],
    ['509712345678', null],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });

  it('does not call a debit "Income" just because it mentions a refund', () => {
    expect(categorize('Refund Processing Fee', 'fee charged', 'debit')).not.toBe('Income');
  });
});

describe('transaction identity', () => {
  const base = parseMessage(
    sms(
      'VM-HDFCBK',
      'Sent Rs.450.00 From HDFC Bank A/C x1234 To SWIGGY On 12/03/25 Ref 509712345678',
    ),
  ).transaction!;

  it('gives the same id to the same payment seen twice', () => {
    const again = parseMessage(
      sms(
        'VM-HDFCBK',
        'Sent Rs.450.00 From HDFC Bank A/C x1234 To SWIGGY On 12/03/25 Ref 509712345678',
      ),
    ).transaction!;
    expect(transactionId(again)).toBe(transactionId(base));
  });

  it('separates two same-value payments with different references', () => {
    const other = { ...base, refNo: '509712345999' };
    expect(transactionId(other)).not.toBe(transactionId(base));
  });

  it('separates a debit from a credit of the same amount', () => {
    const credit = { ...base, direction: 'credit' as const };
    expect(transactionId(credit)).not.toBe(transactionId(base));
  });
});
