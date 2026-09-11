import { encryptSecret, decryptSecret } from './secret-crypto';

// The blog platform password is one of several tenant secrets now; the
// mechanism lives in secret-crypto.ts. These names stay because the call sites
// read better with them, and the wire format is unchanged — values encrypted
// before the split still decrypt.
export function encryptBlogPassword(plaintext: string): string {
  return encryptSecret(plaintext);
}

export function decryptBlogPassword(stored: string): string {
  return decryptSecret(stored);
}
