import { describe, expect, it, afterEach } from 'vitest';
import {
  calculateTextCost,
  calculateImageCost,
  imageRateUsd,
  isModelPriced,
  formatUsd,
  normalizeImageQuality,
  DEFAULT_IMAGE_QUALITY,
  WEB_SEARCH_USD_PER_REQUEST,
  TEXT_MODEL_RATES,
} from './pricing';

afterEach(() => {
  delete process.env.OPENAI_IMAGE_USD_PER_IMAGE;
  delete process.env.OPENAI_IMAGE_USD_PER_IMAGE_LOW;
  delete process.env.OPENAI_IMAGE_USD_PER_IMAGE_MEDIUM;
  delete process.env.OPENAI_IMAGE_USD_PER_IMAGE_HIGH;
  delete process.env.GEMINI_IMAGE_USD_PER_IMAGE;
});

describe('calculateTextCost', () => {
  it('prices input and output at the model rate', () => {
    // Sonnet 4.5: $3/MTok in, $15/MTok out.
    const cost = calculateTextCost('claude-sonnet-4-5-20250929', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost.inputUsd).toBeCloseTo(3, 10);
    expect(cost.outputUsd).toBeCloseTo(15, 10);
    expect(cost.totalUsd).toBeCloseTo(18, 10);
  });

  it('prices cache writes at 1.25x and cache reads at 0.1x base input', () => {
    const cost = calculateTextCost('claude-sonnet-5', {
      cacheCreationInputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
    });
    // Sonnet 5 base input is $2 → write $2.50, read $0.20.
    expect(cost.cacheWriteUsd).toBeCloseTo(2.5, 10);
    expect(cost.cacheReadUsd).toBeCloseTo(0.2, 10);
    expect(cost.totalUsd).toBeCloseTo(2.7, 10);
  });

  it('bills web search per request on top of tokens', () => {
    const cost = calculateTextCost('claude-sonnet-5', {
      inputTokens: 0,
      outputTokens: 0,
      webSearchRequests: 4,
    });
    expect(cost.webSearchUsd).toBeCloseTo(4 * WEB_SEARCH_USD_PER_REQUEST, 10);
    expect(cost.totalUsd).toBeCloseTo(0.04, 10);
  });

  it('treats missing usage fields as zero rather than NaN', () => {
    const cost = calculateTextCost('claude-sonnet-5', {});
    expect(cost.totalUsd).toBe(0);
  });

  it('returns a null total for an unknown model instead of a misleading zero', () => {
    const cost = calculateTextCost('some-future-model', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost.totalUsd).toBeNull();
  });

  it('still prices web search when the model is unknown', () => {
    const cost = calculateTextCost('some-future-model', { webSearchRequests: 2 });
    expect(cost.webSearchUsd).toBeCloseTo(0.02, 10);
  });

  it('prices every model the app actually calls', () => {
    // The two model ids hard-coded in the API routes.
    expect(isModelPriced('claude-sonnet-4-5-20250929')).toBe(true);
    expect(isModelPriced('claude-sonnet-5')).toBe(true);
  });

  it('keeps cache rates consistent with the published multipliers', () => {
    for (const [model, rate] of Object.entries(TEXT_MODEL_RATES)) {
      expect(rate.cacheWrite, `${model} cache write`).toBeCloseTo(rate.input * 1.25, 10);
      expect(rate.cacheRead, `${model} cache read`).toBeCloseTo(rate.input * 0.1, 10);
    }
  });
});

describe('image pricing', () => {
  it('prices gpt-image-2 from the built-in 1024x1024 table', () => {
    expect(imageRateUsd('openai', 'low')).toBeCloseTo(0.00588, 10);
    expect(imageRateUsd('openai', 'medium')).toBeCloseTo(0.05268, 10);
    expect(imageRateUsd('openai', 'high')).toBeCloseTo(0.21072, 10);
  });

  it('costs an unspecified quality at the default tier, not at zero', () => {
    expect(imageRateUsd('openai')).toBeCloseTo(0.00588, 10);
  });

  it('prices Gemini flat, the same at every tier', () => {
    // Nano Banana Pro has no quality tiers in this app.
    expect(imageRateUsd('gemini')).toBeCloseTo(0.09, 10);
    expect(imageRateUsd('gemini', 'high')).toBeCloseTo(0.09, 10);
    expect(calculateImageCost('gemini', 5)).toBeCloseTo(0.45, 10);
  });

  it('leaves an unknown provider unpriced rather than free', () => {
    expect(imageRateUsd('midjourney')).toBeNull();
    expect(calculateImageCost('midjourney', 7)).toBeNull();
  });

  it('lets an env var override the built-in rate', () => {
    process.env.OPENAI_IMAGE_USD_PER_IMAGE = '0.02';
    expect(calculateImageCost('openai', 7, 'high')).toBeCloseTo(0.14, 10);
  });

  it('costs a five-image batch by tier', () => {
    // The realistic case: a post's five slots, all at one quality.
    expect(calculateImageCost('openai', 5, 'low')).toBeCloseTo(0.0294, 10);
    expect(calculateImageCost('openai', 5, 'high')).toBeCloseTo(1.0536, 10);
  });

  it('falls back to the built-in rate when the env override is unusable', () => {
    process.env.GEMINI_IMAGE_USD_PER_IMAGE = 'free';
    expect(imageRateUsd('gemini')).toBeCloseTo(0.09, 10);
    process.env.GEMINI_IMAGE_USD_PER_IMAGE = '-1';
    expect(imageRateUsd('gemini')).toBeCloseTo(0.09, 10);
  });

  it('prices each quality tier separately — a High image is not a Low image', () => {
    // High is ~36x Low, so folding the tiers together would be badly wrong.
    const low = calculateImageCost('openai', 5, 'low')!;
    const high = calculateImageCost('openai', 5, 'high')!;
    expect(high / low).toBeGreaterThan(30);
  });

  it('prefers a per-tier env var over the flat one', () => {
    process.env.OPENAI_IMAGE_USD_PER_IMAGE = '0.02';
    process.env.OPENAI_IMAGE_USD_PER_IMAGE_HIGH = '0.17';

    expect(imageRateUsd('openai', 'high')).toBeCloseTo(0.17, 10);
    expect(imageRateUsd('openai', 'low')).toBeCloseTo(0.02, 10);
  });

  it('lets an env var override the Gemini rate', () => {
    process.env.GEMINI_IMAGE_USD_PER_IMAGE = '0.05';
    expect(imageRateUsd('gemini', 'high')).toBeCloseTo(0.05, 10);
  });
});

describe('normalizeImageQuality', () => {
  it('accepts the three tiers', () => {
    expect(normalizeImageQuality('low')).toBe('low');
    expect(normalizeImageQuality('medium')).toBe('medium');
    expect(normalizeImageQuality('high')).toBe('high');
  });

  it('rejects anything else, so an arbitrary string never reaches the provider', () => {
    expect(normalizeImageQuality('ultra')).toBeNull();
    expect(normalizeImageQuality(undefined)).toBeNull();
    expect(normalizeImageQuality(4)).toBeNull();
  });

  it("defaults to the provider's own default tier", () => {
    expect(DEFAULT_IMAGE_QUALITY).toBe('low');
  });
});

describe('formatUsd', () => {
  it('keeps four decimals for sub-cent amounts', () => {
    expect(formatUsd(0.0032)).toBe('$0.0032');
  });

  it('uses two decimals once the amount is over a dollar', () => {
    expect(formatUsd(12.3456)).toBe('$12.35');
  });

  it('renders exactly zero plainly', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });
});
