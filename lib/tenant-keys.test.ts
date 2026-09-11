import { describe, expect, it, beforeAll, afterEach } from 'vitest';
import {
  resolveApiKey,
  encryptApiKey,
  maskApiKey,
  validateApiKeyFormat,
  describeKeyStatus,
  describeAllKeyStatuses,
  isKeyProvider,
  KEY_COLUMNS,
} from './tenant-keys';

beforeAll(() => {
  process.env.BLOG_CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-do-not-use-in-production';
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

describe('resolveApiKey', () => {
  it("prefers the tenant's own key over the platform key", () => {
    process.env.ANTHROPIC_API_KEY = 'platform-key-value';
    const tenant = { anthropic_api_key_encrypted: encryptApiKey('tenant-key-value') };

    expect(resolveApiKey('anthropic', tenant)).toEqual({
      apiKey: 'tenant-key-value',
      source: 'tenant',
    });
  });

  it('falls back to the platform key so pre-BYOK accounts keep working', () => {
    process.env.OPENAI_API_KEY = 'platform-key-value';

    expect(resolveApiKey('openai', {})).toEqual({
      apiKey: 'platform-key-value',
      source: 'platform',
    });
  });

  it('returns null when neither side has a key, rather than an empty string', () => {
    expect(resolveApiKey('gemini', {})).toBeNull();
    expect(resolveApiKey('gemini', null)).toBeNull();
  });

  it('falls back rather than throwing when the stored key cannot be decrypted', () => {
    process.env.ANTHROPIC_API_KEY = 'platform-key-value';
    const tenant = { anthropic_api_key_encrypted: 'not:valid:ciphertext' };

    expect(resolveApiKey('anthropic', tenant)).toEqual({
      apiKey: 'platform-key-value',
      source: 'platform',
    });
  });

  it('keeps each provider on its own column', () => {
    const tenant = {
      anthropic_api_key_encrypted: encryptApiKey('anthropic-secret'),
      openai_api_key_encrypted: encryptApiKey('openai-secret'),
    };

    expect(resolveApiKey('anthropic', tenant)?.apiKey).toBe('anthropic-secret');
    expect(resolveApiKey('openai', tenant)?.apiKey).toBe('openai-secret');
    expect(resolveApiKey('gemini', tenant)).toBeNull();
  });

  it('maps every provider to a distinct column', () => {
    const columns = Object.values(KEY_COLUMNS);
    expect(new Set(columns).size).toBe(columns.length);
  });
});

describe('encryptApiKey', () => {
  it('never stores the key in plaintext', () => {
    const encrypted = encryptApiKey('sk-ant-super-secret-value');
    expect(encrypted).not.toContain('sk-ant-super-secret-value');
  });
});

describe('maskApiKey', () => {
  it('reveals only the last four characters', () => {
    const masked = maskApiKey('sk-ant-api03-abcdefghijkl-WXYZ');
    expect(masked).toBe('••••••••WXYZ');
    expect(masked).not.toContain('abcdefghijkl');
  });
});

describe('validateApiKeyFormat', () => {
  it('accepts a plausible key', () => {
    expect(validateApiKeyFormat('sk-ant-api03-abcdefghijklmnop')).toBeNull();
  });

  it('rejects an obviously truncated key', () => {
    expect(validateApiKeyFormat('sk-123')).not.toBeNull();
  });

  it('rejects a key with whitespace, which is a pasted command not a key', () => {
    expect(validateApiKeyFormat('curl -H "x-api-key: sk-ant-123"')).not.toBeNull();
    expect(validateApiKeyFormat('sk-ant-api03-abcdefghijkl\n')).not.toBeNull();
  });

  it('rejects an absurdly long value', () => {
    expect(validateApiKeyFormat('a'.repeat(501))).not.toBeNull();
  });
});

describe('describeKeyStatus', () => {
  it('reports a stored key as configured, with a hint but not the key', () => {
    const tenant = { anthropic_api_key_encrypted: encryptApiKey('sk-ant-secret-value-1234') };
    const status = describeKeyStatus('anthropic', tenant);

    expect(status.configured).toBe(true);
    expect(status.hint).toBe('••••••••1234');
    expect(status.usingPlatformKey).toBe(false);
    expect(JSON.stringify(status)).not.toContain('sk-ant-secret-value-1234');
  });

  it('flags a provider that is silently running on the platform key', () => {
    process.env.OPENAI_API_KEY = 'platform-key-value';
    const status = describeKeyStatus('openai', {});

    expect(status.configured).toBe(false);
    expect(status.hint).toBeNull();
    expect(status.usingPlatformKey).toBe(true);
  });

  it('flags a provider that has no key at all', () => {
    const status = describeKeyStatus('gemini', {});
    expect(status.configured).toBe(false);
    expect(status.usingPlatformKey).toBe(false);
  });

  it('describes all three providers', () => {
    expect(describeAllKeyStatuses({}).map((s) => s.provider)).toEqual([
      'anthropic',
      'openai',
      'gemini',
    ]);
  });
});

describe('isKeyProvider', () => {
  it('accepts the known providers and nothing else', () => {
    expect(isKeyProvider('anthropic')).toBe(true);
    expect(isKeyProvider('openai')).toBe(true);
    expect(isKeyProvider('gemini')).toBe(true);
    expect(isKeyProvider('midjourney')).toBe(false);
    expect(isKeyProvider(null)).toBe(false);
  });
});
