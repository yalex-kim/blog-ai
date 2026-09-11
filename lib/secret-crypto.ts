import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// One key protects every secret this app stores on a tenant's behalf: their
// blog platform password and, since BYOK, their model provider API keys. The
// name is historical — renaming it would silently invalidate every existing
// ciphertext on deployments that already set it, which is a far worse outcome
// than an env var whose name is narrower than its job.
function getKey(): Buffer {
  const secret = process.env.BLOG_CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'BLOG_CREDENTIAL_ENCRYPTION_KEY environment variable is required to store tenant secrets.'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Stores as iv:authTag:ciphertext (all hex). GCM's auth tag means a tampered or
 * truncated value fails to decrypt rather than returning garbage.
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted secret format.');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/**
 * Decrypts without throwing. A secret encrypted under a different
 * BLOG_CREDENTIAL_ENCRYPTION_KEY — or corrupted in transit — should degrade to
 * "this tenant has no usable key" rather than failing the whole request, so the
 * caller can fall back or tell the tenant to re-enter it.
 */
export function tryDecryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    return null;
  }
}
