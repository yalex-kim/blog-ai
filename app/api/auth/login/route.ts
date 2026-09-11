import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { createTenantSessionToken, SESSION_COOKIE_MAX_AGE_SECONDS } from '@/lib/session';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isTrustedOrigin } from '@/lib/request-security';
import { isDatabaseFault, logDatabaseFault } from '@/lib/db-errors';

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const { allowed, retryAfterSeconds } = checkRateLimit(
      `login:${getClientIp(request)}`,
      10,
      15 * 60 * 1000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const { login_id, password } = await request.json();

    if (!login_id || !password) {
      return NextResponse.json(
        { error: '로그인 ID와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Find tenant
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('login_id', login_id)
      .single();

    // Same reasoning as the admin route: only "no rows" means bad credentials.
    if (isDatabaseFault(error)) {
      logDatabaseFault('tenant-login', error!);
      return NextResponse.json(
        { error: '서버 설정 문제로 로그인할 수 없습니다. 관리자에게 문의해주세요.', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    if (!tenant) {
      return NextResponse.json(
        { error: '로그인 ID 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, tenant.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: '로그인 ID 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const sessionToken = createTenantSessionToken({
      id: tenant.id,
      login_id: tenant.login_id,
    });

    const response = NextResponse.json({
      message: '로그인 성공',
      tenant: {
        id: tenant.id,
        login_id: tenant.login_id,
        name: tenant.name,
        is_initial_setup_complete: tenant.is_initial_setup_complete,
        must_change_password: tenant.must_change_password,
      },
    });

    // Set session cookie
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
