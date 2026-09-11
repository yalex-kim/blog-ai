import { describe, expect, it, afterEach } from 'vitest';
import {
  calculateTextCost,
  calculateImageCost,
  imageRateUsd,
  isModelPriced,
  formatUsd,
  WEB_SEARCH_USD_PER_REQUEST,
  TEXT_MODEL_RATES,
} from './pricing';

afterEach(() => {
  delete process.env.OPENAI_IMAGE_USD_PER_IMAGE;
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
  it('is unpriced until a rate is configured', () => {
    expect(imageRateUsd('openai')).toBeNull();
    expect(calculateImageCost('openai', 7)).toBeNull();
  });

  it('uses the configured per-image rate', () => {
    process.env.OPENAI_IMAGE_USD_PER_IMAGE = '0.02';
    expect(calculateImageCost('openai', 7)).toBeCloseTo(0.14, 10);
  });

  it('ignores a non-numeric or negative rate', () => {
    process.env.GEMINI_IMAGE_USD_PER_IMAGE = 'free';
    expect(imageRateUsd('gemini')).toBeNull();
    process.env.GEMINI_IMAGE_USD_PER_IMAGE = '-1';
    expect(imageRateUsd('gemini')).toBeNull();
  });

  it('is null for an unknown provider', () => {
    expect(imageRateUsd('midjourney')).toBeNull();
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
