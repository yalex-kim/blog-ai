import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getAdminSession } from '@/lib/session';
import { isTrustedOrigin } from '@/lib/request-security';
import { getVertical, isKnownVertical, DEFAULT_VERTICAL_ID } from '@/lib/verticals/registry';

// Admin creates a new tenant account
export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    // Check admin authentication
    const adminSession = getAdminSession(request);
    if (!adminSession) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    const { login_id, initial_password, vertical = DEFAULT_VERTICAL_ID, category } = await request.json();

    if (typeof vertical !== 'string' || !isKnownVertical(vertical)) {
      return NextResponse.json({ error: '업종이 올바르지 않습니다.' }, { status: 400 });
    }

    // An empty category is normal at creation time — the tenant fills it in
    // during setup — so it falls back to the pack's default rather than failing.
    const resolvedCategory =
      typeof category === 'string' && category.trim()
        ? category.trim()
        : getVertical(vertical).terminology.defaultCategory;

    if (
      !login_id || typeof login_id !== 'string' || login_id.length > 100 ||
      !initial_password || typeof initial_password !== 'string' || initial_password.length < 8
    ) {
      return NextResponse.json(
        { error: '병원 ID와 8자 이상의 초기 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Check if login_id already exists
    const { data: existing } = await supabaseAdmin
      .from('tenants')
      .select('login_id')
      .eq('login_id', login_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 병원 ID입니다.' },
        { status: 409 }
      );
    }

    // Hash the password
    const password_hash = await bcrypt.hash(initial_password, 10);

    // Insert new tenant
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .insert([
        {
          login_id,
          password_hash,
          vertical,
          category: resolvedCategory,
          must_change_password: true,
          is_initial_setup_complete: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating tenant:', error);
      return NextResponse.json(
        { error: '병원 계정 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '병원 계정이 생성되었습니다.',
      tenant: {
        id: data.id,
        login_id: data.login_id,
        vertical: data.vertical,
        category: data.category,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/admin/tenants:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const adminSession = getAdminSession(request);
    if (!adminSession) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, login_id, name, vertical, category, is_initial_setup_complete, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json(
        { error: '병원 목록 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tenants: data });
  } catch (error) {
    console.error('Error in GET /api/admin/tenants:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
