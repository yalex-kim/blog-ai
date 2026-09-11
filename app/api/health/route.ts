import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isConnectionFailure } from '@/lib/db-errors';

// Deployment diagnostics: answers "why is login failing" without anyone being
// able to log in first, which is exactly when you need it.
//
// WHAT THIS DELIBERATELY DOES NOT RETURN: no secret values, no environment
// variable contents, no usernames, no rows — only booleans for "is this
// configured", counts, and the names of columns the schema is missing. Keep it
// that way if you extend it.
//
// Set HEALTH_CHECK_TOKEN in the environment to require `?token=…`; recommended
// once you are past the outage that made you add this.

export const dynamic = 'force-dynamic';

// Every column the app selects, filters or writes, per table. A missing entry
// here is a column whose absence the app discovers at request time instead.
const REQUIRED_COLUMNS: Record<string, string[]> = {
  admins: ['id', 'username', 'password_hash', 'role', 'full_name', 'is_active', 'last_login_at'],
  tenants: [
    'id', 'login_id', 'password_hash', 'vertical', 'category', 'name',
    'main_services', 'address', 'trusted_domains', 'blog_platform', 'blog_id',
    'blog_password_encrypted', 'blog_board_name', 'must_change_password',
    'is_initial_setup_complete', 'created_at',
    // Added by 002; without them BYOK silently degrades rather than erroring.
    'anthropic_api_key_encrypted', 'openai_api_key_encrypted',
    'gemini_api_key_encrypted',
  ],
  blog_posts: [
    'id', 'tenant_id', 'title', 'content', 'topic', 'keywords',
    'image_keywords', 'reference_links', 'posted_to_blog', 'created_at',
  ],
  blog_images: [
    'id', 'blog_post_id', 'keyword', 'text_content', 'image_type', 'prompt_id',
    'display_order', 'storage_path', 'public_url', 'prompt', 'created_at',
  ],
  usage_events: [
    'id', 'tenant_id', 'kind', 'provider', 'model', 'key_source', 'blog_post_id',
    'input_tokens', 'output_tokens', 'cache_creation_input_tokens',
    'cache_read_input_tokens', 'web_search_requests', 'image_count',
    'image_quality', 'cost_usd', 'created_at',
  ],
};

// Which file creates each table, so the report names the fix rather than
// sending everyone to schema.sql regardless of what is actually missing.
const TABLE_SOURCE: Record<string, string> = {
  admins: 'database/schema.sql',
  tenants: 'database/schema.sql',
  blog_posts: 'database/schema.sql',
  blog_images: 'database/schema.sql',
  usage_events: 'database/002_byok_and_usage.sql',
};

// Columns a later migration adds, keyed `table.column`. Anything not listed
// came with schema.sql, so its absence is drift that 001 repairs.
const DEFAULT_COLUMN_SOURCE = 'database/001_repair_schema.sql';

const COLUMN_SOURCE: Record<string, string> = {
  'tenants.anthropic_api_key_encrypted': 'database/002_byok_and_usage.sql',
  'tenants.openai_api_key_encrypted': 'database/002_byok_and_usage.sql',
  'tenants.gemini_api_key_encrypted': 'database/002_byok_and_usage.sql',
};

function columnSource(table: string, column: string): string {
  // A column of a table that a migration created belongs to that migration.
  return (
    COLUMN_SOURCE[`${table}.${column}`] ??
    (TABLE_SOURCE[table] !== 'database/schema.sql' ? TABLE_SOURCE[table] : DEFAULT_COLUMN_SOURCE)
  );
}

// A client built here rather than imported from lib/supabase: that module
// calls createClient at import time and throws when the env vars are missing,
// which is precisely the failure this endpoint exists to report.
function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type AdminDb = ReturnType<typeof createAdminClient>;

/**
 * Is the database answering at all? Asked before anything else, because a
 * paused Supabase project and a missing column both surface as "the query
 * failed" while needing completely different fixes — resume the project versus
 * run a migration. A table that genuinely does not exist still counts as
 * reachable: PostgREST replied, it just replied 42P01.
 */
async function checkConnectivity(db: AdminDb): Promise<{ reachable: boolean; detail: string | null }> {
  try {
    const { error } = await db.from('tenants').select('id').limit(1);
    if (error && isConnectionFailure(error)) {
      return { reachable: false, detail: error.message };
    }
    return { reachable: true, detail: null };
  } catch (error) {
    // A thrown fetch rejection is the same condition, reported differently.
    return { reachable: false, detail: error instanceof Error ? error.message : 'unknown error' };
  }
}

interface TableReport {
  exists: boolean;
  rowCount: number | null;
  missingColumns: string[];
  error: string | null;
}

/**
 * Probes a table by asking for every required column at once. PostgREST rejects
 * the whole select naming only the first unknown column, so on failure we fall
 * back to one probe per column to report the complete set.
 */
async function inspectTable(
  db: AdminDb,
  table: string,
  columns: string[]
): Promise<TableReport> {
  const { error } = await db.from(table).select(columns.join(', ')).limit(1);

  if (!error) {
    const { count } = await db.from(table).select('*', { count: 'exact', head: true });
    return { exists: true, rowCount: count ?? null, missingColumns: [], error: null };
  }

  // 42P01 = undefined_table. PGRST205 is PostgREST's schema-cache equivalent.
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return { exists: false, rowCount: null, missingColumns: columns, error: error.message };
  }

  // 42703 = undefined_column — the drift case. Find all of them, not just the
  // one PostgREST happened to name.
  if (error.code === '42703') {
    const probes = await Promise.all(
      columns.map(async (column) => {
        const { error: columnError } = await db.from(table).select(column).limit(1);
        return { column, missing: columnError?.code === '42703' };
      })
    );
    const missingColumns = probes.filter((p) => p.missing).map((p) => p.column);
    const { count } = await db.from(table).select('*', { count: 'exact', head: true });
    return { exists: true, rowCount: count ?? null, missingColumns, error: null };
  }

  return { exists: true, rowCount: null, missingColumns: [], error: `${error.code}: ${error.message}` };
}

export async function GET(request: NextRequest) {
  const requiredToken = process.env.HEALTH_CHECK_TOKEN;
  if (requiredToken && request.nextUrl.searchParams.get('token') !== requiredToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { allowed } = checkRateLimit(`health:${getClientIp(request)}`, 30, 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    BLOG_CREDENTIAL_ENCRYPTION_KEY: !!process.env.BLOG_CREDENTIAL_ENCRYPTION_KEY,
  };
  // Provider keys are deliberately absent: they are per-tenant now, and a
  // deployment-wide one would not be used even if it were set.

  const problems: string[] = [];
  for (const [name, present] of Object.entries(env)) {
    // Every one of these is load-bearing; the anon key only for client-side
    // Supabase use, which this app does not currently do.
    if (name !== 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && !present) {
      problems.push(`환경변수 ${name} 가 설정되어 있지 않습니다.`);
    }
  }

  // The project identifier, not the key: enough to tell two Supabase projects
  // apart when the deployment points at the wrong one.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseProjectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] ?? null;

  let tables: Record<string, TableReport> | null = null;
  let databaseReachable = false;

  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createAdminClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    try {
      const connectivity = await checkConnectivity(db);
      databaseReachable = connectivity.reachable;

      if (!connectivity.reachable) {
        // Overwhelmingly the free-plan auto-pause, which is silent: the project
        // simply stops answering, and every login then fails in a way that
        // looks nothing like "the database is asleep".
        problems.push(
          `Supabase에 연결할 수 없습니다 (${connectivity.detail ?? 'no response'}). ` +
            '무료 플랜 프로젝트는 약 1주일간 사용하지 않으면 자동으로 일시중지됩니다. ' +
            'Supabase 대시보드에서 프로젝트 상태를 확인하고 Resume 해주세요.'
        );

        return NextResponse.json(
          {
            ok: false,
            checkedAt: new Date().toISOString(),
            env,
            supabaseProjectRef,
            databaseReachable: false,
            tables: null,
            problems,
          },
          { status: 503 }
        );
      }

      const entries = await Promise.all(
        Object.entries(REQUIRED_COLUMNS).map(
          async ([table, columns]) => [table, await inspectTable(db, table, columns)] as const
        )
      );
      tables = Object.fromEntries(entries);

      for (const [table, report] of entries) {
        if (!report.exists) {
          problems.push(
            `테이블 ${table} 이(가) 없습니다. ${TABLE_SOURCE[table] ?? 'database/schema.sql'} 을 실행하세요.`
          );
        } else if (report.missingColumns.length > 0) {
          // Group by the file that adds them: one table can be missing columns
          // from two different migrations at once.
          const bySource = new Map<string, string[]>();
          for (const column of report.missingColumns) {
            const source = columnSource(table, column);
            bySource.set(source, [...(bySource.get(source) ?? []), column]);
          }
          for (const [source, columns] of bySource) {
            problems.push(
              `테이블 ${table} 에 컬럼이 없습니다: ${columns.join(', ')} — ${source} 을 실행하세요.`
            );
          }
        } else if (report.error) {
          problems.push(`테이블 ${table} 조회 실패: ${report.error}`);
        }
      }

      if (tables.admins?.exists && tables.admins.rowCount === 0) {
        problems.push('admins 테이블에 계정이 없습니다. database/create-admin.sql 로 첫 관리자를 만드세요.');
      }
    } catch (error) {
      problems.push(`Supabase 연결 실패: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return NextResponse.json(
    {
      ok: problems.length === 0,
      checkedAt: new Date().toISOString(),
      env,
      supabaseProjectRef,
      databaseReachable,
      tables,
      problems,
    },
    { status: problems.length === 0 ? 200 : 503 }
  );
}
