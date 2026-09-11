import { supabaseAdmin } from './supabase';
import { calculateTextCost, calculateImageCost, type TokenUsage } from './pricing';
import type { KeySource } from './tenant-keys';

export type UsageKind = 'blog_generation' | 'topic_recommendation' | 'image_generation';

export interface UsageEvent {
  tenantId: string;
  kind: UsageKind;
  provider: string;
  model: string;
  keySource: KeySource;
  blogPostId?: string | null;
  tokens?: TokenUsage;
  imageCount?: number;
}

/**
 * Extracts the usage block from an Anthropic Messages response.
 *
 * `server_tool_use.web_search_requests` is the billable search count — each
 * search is $10/1,000 on top of tokens, so a post that searched four times
 * costs four cents before a single token is counted. The SDK's Usage type does
 * not always surface it, hence the narrow cast rather than `any`.
 */
export function extractAnthropicUsage(usage: unknown): TokenUsage {
  const u = (usage ?? {}) as {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    server_tool_use?: { web_search_requests?: number } | null;
  };

  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
    webSearchRequests: u.server_tool_use?.web_search_requests ?? 0,
  };
}

/**
 * Writes one usage row. Deliberately never throws: metering is bookkeeping, and
 * losing a row is a much better outcome than failing a generation the tenant
 * has already been charged for by the provider.
 */
export async function recordUsage(event: UsageEvent): Promise<void> {
  try {
    const imageCount = event.imageCount ?? 0;
    const cost =
      event.kind === 'image_generation'
        ? {
            totalUsd: calculateImageCost(event.provider, imageCount),
            webSearchUsd: 0,
          }
        : calculateTextCost(event.model, event.tokens ?? {});

    const { error } = await supabaseAdmin.from('usage_events').insert([
      {
        tenant_id: event.tenantId,
        kind: event.kind,
        provider: event.provider,
        model: event.model,
        key_source: event.keySource,
        blog_post_id: event.blogPostId ?? null,
        input_tokens: event.tokens?.inputTokens ?? 0,
        output_tokens: event.tokens?.outputTokens ?? 0,
        cache_creation_input_tokens: event.tokens?.cacheCreationInputTokens ?? 0,
        cache_read_input_tokens: event.tokens?.cacheReadInputTokens ?? 0,
        web_search_requests: event.tokens?.webSearchRequests ?? 0,
        image_count: imageCount,
        // Null means "we could not price this" — an unknown model, or an image
        // provider with no configured rate. The dashboard reports those rows as
        // unpriced rather than folding them in as $0.
        cost_usd: cost.totalUsd,
      },
    ]);

    if (error) {
      console.error('[usage] failed to record usage event', {
        code: error.code,
        message: error.message,
        kind: event.kind,
      });
    }
  } catch (error) {
    console.error('[usage] unexpected error recording usage event', error);
  }
}
