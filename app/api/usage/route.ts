import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import type { PostgrestError } from '@supabase/supabase-js';
import { isDatabaseFault, logDatabaseFault } from '@/lib/db-errors';

// Spend for the signed-in tenant. Aggregated in this process rather than in
// SQL: PostgREST has no GROUP BY, and the alternative is a database function
// that has to be migrated in lockstep with this file. At this row count the
// difference is not measurable — but the window is capped so it cannot become
// unbounded if a tenant generates very heavily.
const MAX_ROWS = 5000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

type UsageRow = {
  kind: string;
  provider: string;
  model: string;
  key_source: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  web_search_requests: number;
  image_count: number;
  image_quality: string | null;
  cost_usd: string | number | null;
  created_at: string;
};

/**
 * Turns a PostgREST failure on `usage_events` into the actual next step.
 *
 * The table and its columns arrive together in 002, but they can be missing
 * independently: a copy of that file taken before `image_quality` was added
 * creates the table without it, and then the table exists while the select
 * still fails. Supabase's schema cache adds a third case where everything is
 * present but PostgREST has not noticed yet.
 */
function describeUsageTableFault(error: PostgrestError): string {
  // 42P01 undefined_table — nothing was created.
  if (error.code === '42P01') {
    return 'usage_events 테이블이 없습니다. database/002_byok_and_usage.sql 을 실행해주세요.';
  }

  // PGRST205 — the table may well exist; PostgREST's schema cache is stale.
  if (error.code === 'PGRST205') {
    return (
      'usage_events 테이블을 찾을 수 없습니다. 방금 마이그레이션을 실행하셨다면 ' +
      "Supabase SQL Editor에서 NOTIFY pgrst, 'reload schema'; 를 실행하거나 잠시 후 다시 시도해주세요."
    );
  }

  // 42703 undefined_column — the table exists but is from an older copy of 002.
  if (error.code === '42703') {
    const column = error.message.match(/column\s+\S*?\.?"?([a-z_]+)"?\s+does not exist/i)?.[1];
    return (
      `usage_events 테이블에 ${column ? `'${column}' ` : ''}컬럼이 없습니다. ` +
      'database/002_byok_and_usage.sql 의 최신 버전을 실행해주세요 — ' +
      '이전 버전으로 만든 테이블에는 이 컬럼이 없습니다.'
    );
  }

  return '사용량 데이터를 불러올 수 없습니다.';
}

// NUMERIC comes back from PostgREST as a string to preserve precision.
function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestedDays = Number(request.nextUrl.searchParams.get('days') ?? DEFAULT_DAYS);
    const days = Number.isFinite(requestedDays)
      ? Math.min(Math.max(Math.trunc(requestedDays), 1), MAX_DAYS)
      : DEFAULT_DAYS;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('usage_events')
      .select(
        'kind, provider, model, key_source, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, web_search_requests, image_count, image_quality, cost_usd, created_at'
      )
      .eq('tenant_id', sessionData.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);

    if (isDatabaseFault(error)) {
      logDatabaseFault('usage', error!);
      // Never a bare "did you run the migration?". The three ways this fails
      // need three different fixes, and a message that cannot tell them apart
      // sends people to re-run a migration they already ran.
      return NextResponse.json(
        {
          error: describeUsageTableFault(error!),
          code: 'DB_ERROR',
          // PostgREST's own text names the missing object. It is schema
          // information, not row data, and this route already requires a
          // session — worth surfacing so the fix does not need a log dive.
          detail: `${error!.code}: ${error!.message}`,
        },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as UsageRow[];

    let totalUsd = 0;
    let tenantKeyUsd = 0;
    let platformKeyUsd = 0;
    let unpricedEvents = 0;

    const totals = {
      events: rows.length,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      webSearchRequests: 0,
      imageCount: 0,
    };

    const byDay = new Map<string, { date: string; usd: number; events: number }>();
    const byModel = new Map<
      string,
      {
        provider: string;
        model: string;
        kind: string;
        imageQuality: string | null;
        events: number;
        inputTokens: number;
        outputTokens: number;
        imageCount: number;
        usd: number;
        unpricedEvents: number;
      }
    >();

    for (const row of rows) {
      const cost = toNumber(row.cost_usd);

      totals.inputTokens += row.input_tokens ?? 0;
      totals.outputTokens += row.output_tokens ?? 0;
      totals.cacheCreationInputTokens += row.cache_creation_input_tokens ?? 0;
      totals.cacheReadInputTokens += row.cache_read_input_tokens ?? 0;
      totals.webSearchRequests += row.web_search_requests ?? 0;
      totals.imageCount += row.image_count ?? 0;

      if (cost === null) {
        // An unknown model or an unpriced image provider. Counted, never summed
        // as zero — a dashboard that silently drops these understates the bill.
        unpricedEvents += 1;
      } else {
        totalUsd += cost;
        if (row.key_source === 'tenant') tenantKeyUsd += cost;
        else platformKeyUsd += cost;
      }

      const date = row.created_at.slice(0, 10);
      const day = byDay.get(date) ?? { date, usd: 0, events: 0 };
      day.usd += cost ?? 0;
      day.events += 1;
      byDay.set(date, day);

      // Image rows split by quality tier: that, not the model, is what the
      // price varies by, so folding the tiers together would hide the spend.
      const modelKey = `${row.provider}::${row.model}::${row.kind}::${row.image_quality ?? ''}`;
      const entry = byModel.get(modelKey) ?? {
        provider: row.provider,
        model: row.model,
        kind: row.kind,
        imageQuality: row.image_quality,
        events: 0,
        inputTokens: 0,
        outputTokens: 0,
        imageCount: 0,
        usd: 0,
        unpricedEvents: 0,
      };
      entry.events += 1;
      entry.inputTokens += row.input_tokens ?? 0;
      entry.outputTokens += row.output_tokens ?? 0;
      entry.imageCount += row.image_count ?? 0;
      if (cost === null) entry.unpricedEvents += 1;
      else entry.usd += cost;
      byModel.set(modelKey, entry);
    }

    return NextResponse.json({
      days,
      since,
      truncated: rows.length === MAX_ROWS,
      summary: {
        totalUsd,
        tenantKeyUsd,
        platformKeyUsd,
        unpricedEvents,
        ...totals,
      },
      byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byModel: [...byModel.values()].sort((a, b) => b.usd - a.usd),
      recent: rows.slice(0, 20).map((row) => ({
        kind: row.kind,
        provider: row.provider,
        model: row.model,
        keySource: row.key_source,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        webSearchRequests: row.web_search_requests,
        imageCount: row.image_count,
        imageQuality: row.image_quality,
        costUsd: toNumber(row.cost_usd),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Error in GET /api/usage:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
