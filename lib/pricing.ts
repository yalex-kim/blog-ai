// Cost estimation for the usage dashboard.
//
// This turns the token counts the providers report into a dollar figure. It is
// an ESTIMATE, and the dashboard says so: the provider's own invoice is
// authoritative, discounts and free tiers are not modelled here, and a rate
// published today can change tomorrow. The token and request counts stored
// alongside it are the ground truth — if a rate is wrong, the recorded usage is
// still correct and can be re-costed.

/** Rates per million tokens, in USD. */
export interface TextModelRate {
  input: number;
  output: number;
  /** 5-minute cache write. 1.25x base input across the Claude lineup. */
  cacheWrite: number;
  /** Cache read/hit. 0.1x base input for every model this app uses. */
  cacheRead: number;
}

// Source: https://platform.claude.com/docs/en/about-claude/pricing (2026-09-11).
// Keyed by the exact model id passed to the API. Update here and nowhere else.
export const TEXT_MODEL_RATES: Record<string, TextModelRate> = {
  'claude-sonnet-4-5-20250929': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-5': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-opus-5': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

/** $10 per 1,000 searches, billed on top of tokens. Same source as above. */
export const WEB_SEARCH_USD_PER_REQUEST = 10 / 1000;

/** The quality tiers the dashboard offers. OpenAI prices each differently. */
export const IMAGE_QUALITIES = ['low', 'medium', 'high'] as const;
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

/** Matches OpenAIImageProvider's own default, so an unspecified quality is
 *  costed as what was actually generated. */
export const DEFAULT_IMAGE_QUALITY: ImageQuality = 'low';

export function normalizeImageQuality(value: unknown): ImageQuality | null {
  return typeof value === 'string' && (IMAGE_QUALITIES as readonly string[]).includes(value)
    ? (value as ImageQuality)
    : null;
}

// Image generation is priced per image, and on OpenAI the price depends on both
// the quality tier the dashboard lets the user pick and the size. THESE RATES
// ARE FOR 1024x1024, which is what lib/image-providers hard-codes for every
// slot — change that size and these numbers stop being right.
//
// gpt-image-2 source: developers.openai.com/api/docs/pricing (2026-09-11).
// Gemini has no built-in rate: its pricing page was not reachable when this was
// written, and a made-up number in a billing view is worse than an honest
// blank, so Gemini images stay unpriced until an env var supplies a rate.
//
// Override or supply rates with, in precedence order:
//   OPENAI_IMAGE_USD_PER_IMAGE_LOW / _MEDIUM / _HIGH   (per tier)
//   OPENAI_IMAGE_USD_PER_IMAGE                          (flat, all tiers)
//   the built-in table below
// and the same shape for GEMINI_IMAGE_USD_PER_IMAGE[_TIER].
const IMAGE_RATE_ENV_PREFIX: Record<string, string> = {
  openai: 'OPENAI_IMAGE_USD_PER_IMAGE',
  gemini: 'GEMINI_IMAGE_USD_PER_IMAGE',
};

const IMAGE_RATES: Record<string, Record<ImageQuality, number> | null> = {
  // gpt-image-2, 1024x1024
  openai: { low: 0.00588, medium: 0.05268, high: 0.21072 },
  // gemini-3-pro-image-preview — rate unknown, see above
  gemini: null,
};

function readRate(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function imageRateUsd(provider: string, quality?: ImageQuality | null): number | null {
  const prefix = IMAGE_RATE_ENV_PREFIX[provider];
  if (!prefix) return null;

  if (quality) {
    const tiered = readRate(`${prefix}_${quality.toUpperCase()}`);
    if (tiered !== null) return tiered;
  }

  const flat = readRate(prefix);
  if (flat !== null) return flat;

  const table = IMAGE_RATES[provider];
  if (!table) return null;

  return table[quality ?? DEFAULT_IMAGE_QUALITY];
}

export interface TokenUsage {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheCreationInputTokens?: number | null;
  cacheReadInputTokens?: number | null;
  webSearchRequests?: number | null;
}

export interface CostBreakdown {
  /** Null when no rate is known for the model — the caller must not render 0. */
  totalUsd: number | null;
  inputUsd: number;
  outputUsd: number;
  cacheWriteUsd: number;
  cacheReadUsd: number;
  webSearchUsd: number;
}

const PER_MILLION = 1_000_000;

export function calculateTextCost(model: string, usage: TokenUsage): CostBreakdown {
  const rate = TEXT_MODEL_RATES[model];

  // Web search is priced per request regardless of which model ran it, so it is
  // still knowable when the model itself is not.
  const webSearchUsd = (usage.webSearchRequests ?? 0) * WEB_SEARCH_USD_PER_REQUEST;

  if (!rate) {
    return {
      totalUsd: null,
      inputUsd: 0,
      outputUsd: 0,
      cacheWriteUsd: 0,
      cacheReadUsd: 0,
      webSearchUsd,
    };
  }

  const inputUsd = ((usage.inputTokens ?? 0) * rate.input) / PER_MILLION;
  const outputUsd = ((usage.outputTokens ?? 0) * rate.output) / PER_MILLION;
  const cacheWriteUsd = ((usage.cacheCreationInputTokens ?? 0) * rate.cacheWrite) / PER_MILLION;
  const cacheReadUsd = ((usage.cacheReadInputTokens ?? 0) * rate.cacheRead) / PER_MILLION;

  return {
    totalUsd: inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd + webSearchUsd,
    inputUsd,
    outputUsd,
    cacheWriteUsd,
    cacheReadUsd,
    webSearchUsd,
  };
}

export function calculateImageCost(
  provider: string,
  imageCount: number,
  quality?: ImageQuality | null
): number | null {
  const rate = imageRateUsd(provider, quality);
  if (rate === null) return null;
  return rate * imageCount;
}

export function isModelPriced(model: string): boolean {
  return model in TEXT_MODEL_RATES;
}

/** Formats a USD amount for the dashboard. Sub-cent spend is the common case
 *  for a single post, so it keeps four decimals until the number is big enough
 *  not to need them. */
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}
