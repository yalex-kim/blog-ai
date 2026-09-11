import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

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
  ],
  blog_posts: [
    'id', 'tenant_id', 'title', 'content', 'topic', 'keywords',
    'image_keywords', 'reference_links', 'posted_to_blog', 'created_at',
  ],
  blog_images: [
    'id', 'blog_post_id', 'keyword', 'text_content', 'image_type', 'prompt_id',
    'display_order', 'storage_path', 'public_url', 'prompt', 'created_at',
  ],
};

// A client built here rather than imported from lib/supabase: that module
// calls createClient at import time and throws when the env vars are missing,
// which is precisely the failure this endpoint exists to report.
function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type AdminDb = ReturnType<typeof createAdminClient>;

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
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
  };

  const problems: string[] = [];
  for (const [name, present] of Object.entries(env)) {
    // The image keys are optional per provider, and BYOK means a tenant can
    // supply the model keys themselves — only the first four are load-bearing.
    const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET', 'BLOG_CREDENTIAL_ENCRYPTION_KEY'];
    if (required.includes(name) && !present) {
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
      const entries = await Promise.all(
        Object.entries(REQUIRED_COLUMNS).map(
          async ([table, columns]) => [table, await inspectTable(db, table, columns)] as const
        )
      );
      tables = Object.fromEntries(entries);
      databaseReachable = true;

      for (const [table, report] of entries) {
        if (!report.exists) {
          problems.push(`테이블 ${table} 이(가) 없습니다. database/schema.sql 을 실행하세요.`);
        } else if (report.missingColumns.length > 0) {
          problems.push(
            `테이블 ${table} 에 컬럼이 없습니다: ${report.missingColumns.join(', ')} — database/001_repair_schema.sql 을 실행하세요.`
          );
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
