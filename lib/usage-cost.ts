import { calculateTextCost, calculateImageCost, normalizeImageQuality } from './pricing';

/** The columns costing needs. A row from `usage_events`, narrowed. */
export interface CostableUsageRow {
  kind: string;
  provider: string;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  web_search_requests?: number | null;
  image_count?: number | null;
  image_quality?: string | null;
  cost_usd?: string | number | null;
}

/** NUMERIC arrives from PostgREST as a string, to keep precision. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Prices a row from the counts it stored, at today's rates.
 *
 * `cost_usd` is computed when the row is written, so a row written while a rate
 * was unknown keeps a NULL cost forever and adding the rate later does nothing
 * for it. The counts never went missing, though — which is the whole reason
 * they are stored separately from the money — so the row can be re-costed.
 */
export function recomputeCost(row: CostableUsageRow): number | null {
  if (row.kind === 'image_generation') {
    // Rows written before image_quality existed carry null, and are costed at
    // the provider's default tier — the tier the generation itself defaulted to.
    return calculateImageCost(
      row.provider,
      row.image_count ?? 0,
      normalizeImageQuality(row.image_quality)
    );
  }

  return calculateTextCost(row.model, {
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    webSearchRequests: row.web_search_requests,
  }).totalUsd;
}

/**
 * The stored cost wins where it exists — it was computed with the rate in
 * effect at the time, and restating past spend at today's prices would be its
 * own kind of wrong. Re-costing only fills the blanks.
 */
export function rowCost(row: CostableUsageRow): number | null {
  return toNumber(row.cost_usd) ?? recomputeCost(row);
}

export interface PostCost {
  /** Null when nothing about this post could be priced. */
  totalUsd: number | null;
  textUsd: number;
  imageUsd: number;
  /** Rows that carried no usable rate, so the total understates them. */
  unpricedEvents: number;
}

/** Sums usage rows into a per-post figure, split the way a user thinks about
 *  it: the writing, and the pictures. */
export function summarisePostCost(rows: CostableUsageRow[]): PostCost {
  let textUsd = 0;
  let imageUsd = 0;
  let unpricedEvents = 0;
  let priced = 0;

  for (const row of rows) {
    const cost = rowCost(row);
    if (cost === null) {
      unpricedEvents += 1;
      continue;
    }
    priced += 1;
    if (row.kind === 'image_generation') imageUsd += cost;
    else textUsd += cost;
  }

  return {
    totalUsd: priced > 0 ? textUsd + imageUsd : null,
    textUsd,
    imageUsd,
    unpricedEvents,
  };
}
