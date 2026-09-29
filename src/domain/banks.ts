import type { Bank } from './types';

/**
 * Seed registry. `smsSenders` are the uppercase fragments that appear in the
 * 6-character Indian sender id after the TRAI prefix — e.g. "VM-HDFCBK",
 * "AD-HDFCBK" and "JD-HDFCBK" all carry the fragment "HDFCBK".
 */
export const BANKS: Bank[] = [
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    shortName: 'HDFC',
    color: '#004C8F',
    smsSenders: ['HDFCBK', 'HDFCBN', 'HDFCB'],
    emailDomains: ['hdfcbank.net', 'hdfcbank.com'],
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    shortName: 'ICICI',
    color: '#AE282E',
    smsSenders: ['ICICIB', 'ICICIT', 'ICICI'],
    emailDomains: ['icicibank.com', 'icicibank.net'],
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    shortName: 'SBI',
    color: '#22409A',
    smsSenders: ['SBIINB', 'SBIUPI', 'SBICRD', 'SBIPSG', 'ATMSBI', 'CBSSBI'],
    emailDomains: ['sbi.co.in', 'alerts.sbi.co.in'],
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    shortName: 'Axis',
    color: '#97144D',
    smsSenders: ['AXISBK', 'AXISBN', 'AXISB'],
    emailDomains: ['axisbank.com'],
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    shortName: 'Kotak',
    color: '#ED1C24',
    smsSenders: ['KOTAKB', 'KOTAK'],
    emailDomains: ['kotak.com'],
  },
];

const senderIndex = new Map<string, string>();
for (const bank of BANKS) {
  for (const frag of bank.smsSenders) {
    senderIndex.set(frag.toUpperCase(), bank.id);
  }
}

const domainIndex = new Map<string, string>();
for (const bank of BANKS) {
  for (const domain of bank.emailDomains) {
    domainIndex.set(domain.toLowerCase(), bank.id);
  }
}

export const bankById = new Map(BANKS.map(b => [b.id, b]));

/** "VM-HDFCBK" | "AD-HDFCBK-S" -> "hdfc" */
export function bankIdFromSmsSender(sender: string): string | null {
  const upper = sender.toUpperCase();
  for (const [frag, id] of senderIndex) {
    if (upper.includes(frag)) return id;
  }
  return null;
}

/** "alerts@hdfcbank.net" -> "hdfc" */
export function bankIdFromEmailAddress(address: string): string | null {
  const at = address.lastIndexOf('@');
  if (at === -1) return null;
  const host = address.slice(at + 1).toLowerCase().replace(/>$/, '');
  for (const [domain, id] of domainIndex) {
    if (host === domain || host.endsWith('.' + domain)) return id;
  }
  return null;
}
