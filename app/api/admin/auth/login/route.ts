import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { createAdminSessionToken, SESSION_COOKIE_MAX_AGE_SECONDS } from '@/lib/session';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isTrustedOrigin } from '@/lib/request-security';

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const { allowed, retryAfterSeconds } = checkRateLimit(
      `admin-login:${getClientIp(request)}`,
      10,
      15 * 60 * 1000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const username = body.username?.trim();
    const password = body.password?.trim();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'ID와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Fetch admin from database
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: '잘못된 관리자 ID 또는 비밀번호입니다.' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: '잘못된 관리자 ID 또는 비밀번호입니다.' },
        { status: 401 }
      );
    }

    // Update last login time
    await supabaseAdmin
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    const sessionToken = createAdminSessionToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });

    const response = NextResponse.json({
      message: '로그인 성공',
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        full_name: admin.full_name,
      },
    });

    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in admin login:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
