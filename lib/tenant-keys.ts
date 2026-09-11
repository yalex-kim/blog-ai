import { encryptSecret, tryDecryptSecret } from './secret-crypto';

export const KEY_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
export type KeyProvider = (typeof KEY_PROVIDERS)[number];

/** Where a key came from. Recorded on every usage row so a tenant's dashboard
 *  can show what their own key was charged, separately from platform-funded
 *  calls made before they supplied one. */
export type KeySource = 'tenant' | 'platform';

export interface ResolvedKey {
  apiKey: string;
  source: KeySource;
}

/** The tenant columns this module reads. Kept narrow so callers can select
 *  exactly these and nothing else. */
export interface TenantKeyColumns {
  anthropic_api_key_encrypted?: string | null;
  openai_api_key_encrypted?: string | null;
  gemini_api_key_encrypted?: string | null;
}

export const KEY_COLUMNS: Record<KeyProvider, keyof TenantKeyColumns> = {
  anthropic: 'anthropic_api_key_encrypted',
  openai: 'openai_api_key_encrypted',
  gemini: 'gemini_api_key_encrypted',
};

const PLATFORM_ENV_VARS: Record<KeyProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

export const PROVIDER_LABELS: Record<KeyProvider, string> = {
  anthropic: 'Anthropic (글 생성)',
  openai: 'OpenAI (이미지 생성)',
  gemini: 'Google Gemini (이미지 생성)',
};

export function isKeyProvider(value: unknown): value is KeyProvider {
  return typeof value === 'string' && (KEY_PROVIDERS as readonly string[]).includes(value);
}

/**
 * The tenant's own key wins; the platform env var is the fallback.
 *
 * The fallback is what makes BYOK a migration rather than a breaking change:
 * accounts that predate it keep working on the platform key until they enter
 * their own. Deployments that want strict BYOK just leave the env vars unset,
 * and a tenant without a key gets a clear error instead of someone else's bill.
 */
export function resolveApiKey(
  provider: KeyProvider,
  tenant: TenantKeyColumns | null | undefined
): ResolvedKey | null {
  const tenantKey = tryDecryptSecret(tenant?.[KEY_COLUMNS[provider]]);
  if (tenantKey) return { apiKey: tenantKey, source: 'tenant' };

  const platformKey = process.env[PLATFORM_ENV_VARS[provider]];
  if (platformKey) return { apiKey: platformKey, source: 'platform' };

  return null;
}

export function missingKeyMessage(provider: KeyProvider): string {
  return `${PROVIDER_LABELS[provider]} API 키가 등록되어 있지 않습니다. 설정 페이지에서 키를 입력해주세요.`;
}

// Deliberately not a per-provider prefix check. Providers rotate key formats
// (Anthropic alone has shipped several), and a prefix rule that is right today
// turns into a support ticket the day it changes. These bounds only catch a
// pasted-wrong-thing: an empty box, a whole curl command, a key with a stray
// newline.
const MIN_KEY_LENGTH = 16;
const MAX_KEY_LENGTH = 500;

export function validateApiKeyFormat(value: string): string | null {
  if (value.length < MIN_KEY_LENGTH) return 'API 키가 너무 짧습니다.';
  if (value.length > MAX_KEY_LENGTH) return 'API 키가 너무 깁니다.';
  if (/\s/.test(value)) return 'API 키에 공백이나 줄바꿈이 포함되어 있습니다.';
  return null;
}

export function encryptApiKey(plaintext: string): string {
  return encryptSecret(plaintext);
}

/**
 * A recognisable stub for the settings UI: enough for a tenant to confirm which
 * key is stored, not enough to be worth stealing. Never send the key itself to
 * a client — once stored, it is write-only.
 */
export function maskApiKey(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return `••••••••${tail}`;
}

export interface KeyStatus {
  provider: KeyProvider;
  label: string;
  configured: boolean;
  hint: string | null;
  /** True when this provider is currently falling back to the platform's key. */
  usingPlatformKey: boolean;
}

export function describeKeyStatus(
  provider: KeyProvider,
  tenant: TenantKeyColumns | null | undefined
): KeyStatus {
  const tenantKey = tryDecryptSecret(tenant?.[KEY_COLUMNS[provider]]);
  const platformKey = process.env[PLATFORM_ENV_VARS[provider]];

  return {
    provider,
    label: PROVIDER_LABELS[provider],
    configured: !!tenantKey,
    hint: tenantKey ? maskApiKey(tenantKey) : null,
    usingPlatformKey: !tenantKey && !!platformKey,
  };
}

export function describeAllKeyStatuses(tenant: TenantKeyColumns | null | undefined): KeyStatus[] {
  return KEY_PROVIDERS.map((provider) => describeKeyStatus(provider, tenant));
}
