import { describe, expect, it, beforeAll } from 'vitest';
import { encryptBlogPassword, decryptBlogPassword } from './blog-credential-crypto';

beforeAll(() => {
  process.env.BLOG_CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-do-not-use-in-production';
});

describe('blog credential encryption', () => {
  it('round-trips a password', () => {
    const encrypted = encryptBlogPassword('my-blog-password');
    expect(encrypted).not.toContain('my-blog-password');
    expect(decryptBlogPassword(encrypted)).toBe('my-blog-password');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptBlogPassword('same-password');
    const b = encryptBlogPassword('same-password');
    expect(a).not.toEqual(b);
  });
});
