/**
 * FNV-1a 64-bit, expressed with BigInt. The app needs a short stable id derived
 * from a few fields, not a cryptographic digest — this avoids pulling a crypto
 * polyfill into the bundle for something a hash table would do.
 */
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export function stableHash(input: string): string {
  let h = OFFSET;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * PRIME) & MASK;
  }
  return h.toString(16).padStart(16, '0');
}
