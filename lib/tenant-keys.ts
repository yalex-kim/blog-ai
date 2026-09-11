import { encryptSecret, tryDecryptSecret } from './secret-crypto';

export const KEY_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
export type KeyProvider = (typeof KEY_PROVIDERS)[number];

/** Where a key came from. Only 'tenant' is produced today — every call is paid
 *  for by the tenant's own key. 'platform' stays in the type and in the stored
 *  column for rows written while the env fallback existed, and for the planned
 *  admin-granted plan allowance, so the dashboard never has to guess who paid
 *  for a historical row. */
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

// `as const` rather than a Record annotation: the annotation widens each value
// to `keyof TenantKeyColumns`, and a select string built from a union of column
// names makes supabase-js infer a union of row shapes instead of one row.
export const KEY_COLUMNS = {
  anthropic: 'anthropic_api_key_encrypted',
  openai: 'openai_api_key_encrypted',
  gemini: 'gemini_api_key_encrypted',
} as const satisfies Record<KeyProvider, keyof TenantKeyColumns>;

export const PROVIDER_LABELS: Record<KeyProvider, string> = {
  anthropic: 'Anthropic (글 생성)',
  openai: 'OpenAI (이미지 생성)',
  gemini: 'Google Gemini (이미지 생성)',
};

export function isKeyProvider(value: unknown): value is KeyProvider {
  return typeof value === 'string' && (KEY_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Strictly the tenant's own key. No environment fallback: a deployment-wide key
 * would let an account generate without ever entering one, quietly billing the
 * operator, and would leave the tenant no reason to supply theirs.
 *
 * Granting an account allowance on a platform key is an admin decision tied to
 * a plan, not a silent default — when that lands it belongs behind an explicit
 * per-tenant grant, not behind `process.env`.
 */
export function resolveApiKey(
  provider: KeyProvider,
  tenant: TenantKeyColumns | null | undefined
): ResolvedKey | null {
  const tenantKey = tryDecryptSecret(tenant?.[KEY_COLUMNS[provider]]);
  return tenantKey ? { apiKey: tenantKey, source: 'tenant' } : null;
}

export function missingKeyMessage(provider: KeyProvider): string {
  return `${PROVIDER_LABELS[provider]} API 키가 등록되어 있지 않습니다. 설정 페이지에서 키를 등록한 뒤 다시 시도해주세요.`;
}

/** Sent alongside the 400 so the client can render a "go to settings" prompt
 *  rather than pattern-matching the Korean message. */
export const MISSING_API_KEY_CODE = 'MISSING_API_KEY';

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
}

export function describeKeyStatus(
  provider: KeyProvider,
  tenant: TenantKeyColumns | null | undefined
): KeyStatus {
  const tenantKey = tryDecryptSecret(tenant?.[KEY_COLUMNS[provider]]);

  return {
    provider,
    label: PROVIDER_LABELS[provider],
    configured: !!tenantKey,
    hint: tenantKey ? maskApiKey(tenantKey) : null,
  };
}

export function describeAllKeyStatuses(tenant: TenantKeyColumns | null | undefined): KeyStatus[] {
  return KEY_PROVIDERS.map((provider) => describeKeyStatus(provider, tenant));
}
