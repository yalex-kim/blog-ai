import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/session';
import { isTrustedOrigin } from '@/lib/request-security';

// Get tenant details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = getAdminSession(request);
    if (!adminSession) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Never return credential material (password hash, blog platform password) to the admin client
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, login_id, name, vertical, category, main_services, address, blog_platform, blog_id, blog_board_name, is_initial_setup_complete, must_change_password, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !tenant) {
      return NextResponse.json(
        { error: '병원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Update tenant details
const MAX_TEXT_FIELD_LENGTH = 200;
const MAX_SERVICES = 20;

function isValidHospitalUpdate(body: Record<string, unknown>): boolean {
  for (const field of ['name', 'category', 'address']) {
    const value = body[field];
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > MAX_TEXT_FIELD_LENGTH)) {
      return false;
    }
  }
  if (body.main_services !== undefined && body.main_services !== null) {
    const services = body.main_services;
    if (
      !Array.isArray(services) ||
      services.length > MAX_SERVICES ||
      !services.every((s) => typeof s === 'string' && s.length <= MAX_TEXT_FIELD_LENGTH)
    ) {
      return false;
    }
  }
  return true;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const adminSession = getAdminSession(request);
    if (!adminSession) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (!isValidHospitalUpdate(body)) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const {
      name,
      category,
      address,
      main_services,
    } = body;

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({
        name,
        category,
        address,
        main_services,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant:', error);
      return NextResponse.json(
        { error: '병원 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { password_hash, blog_password_encrypted, ...tenantData } = data;
    void password_hash;
    void blog_password_encrypted;

    return NextResponse.json({ tenant: tenantData });
  } catch (error) {
    console.error('Error in PUT /api/admin/tenants/[id]:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
