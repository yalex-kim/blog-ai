import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { encryptBlogPassword } from '@/lib/blog-credential-crypto';
import { isTrustedOrigin } from '@/lib/request-security';
import { isValidDomainEntry } from '@/lib/trusted-domains';

const MAX_TEXT_FIELD_LENGTH = 200;
const MAX_SERVICES = 20;
const MAX_DOMAINS = 20;

// Get tenant settings
export async function GET(request: NextRequest) {
  try {
    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', sessionData.id)
      .single();

    if (error || !tenant) {
      return NextResponse.json(
        { error: '병원 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Don't send credential material to the client
    const { password_hash, blog_password_encrypted, ...tenantData } = tenant;
    void password_hash;
    void blog_password_encrypted;

    return NextResponse.json({ tenant: tenantData });
  } catch (error) {
    console.error('Error in GET /api/tenant/settings:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function isValidUpdatePayload(updates: Record<string, unknown>): boolean {
  const textFields = ['name', 'category', 'address', 'blog_platform', 'blog_id', 'blog_password_encrypted', 'blog_board_name'];
  for (const field of textFields) {
    const value = updates[field];
    if (value !== undefined && (typeof value !== 'string' || value.length > MAX_TEXT_FIELD_LENGTH)) {
      return false;
    }
  }

  if (updates.main_services !== undefined) {
    const services = updates.main_services;
    if (
      !Array.isArray(services) ||
      services.length > MAX_SERVICES ||
      !services.every((s) => typeof s === 'string' && s.length <= MAX_TEXT_FIELD_LENGTH)
    ) {
      return false;
    }
  }

  if (updates.trusted_domains !== undefined) {
    const domains = updates.trusted_domains;
    if (
      !Array.isArray(domains) ||
      domains.length > MAX_DOMAINS ||
      !domains.every((d) => typeof d === 'string' && d.length <= MAX_TEXT_FIELD_LENGTH && isValidDomainEntry(d))
    ) {
      return false;
    }
  }

  return true;
}

// Update tenant settings
export async function PUT(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const updates = await request.json();

    if (!isValidUpdatePayload(updates)) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // Fields that can be updated
    const allowedFields = [
      'name',
      'category',
      'main_services',
      'address',
      'trusted_domains',
      'blog_platform',
      'blog_id',
      'blog_password_encrypted',
      'blog_board_name',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // The blog platform password is the tenant's external credential —
    // never store it in plaintext.
    if (typeof updateData.blog_password_encrypted === 'string' && updateData.blog_password_encrypted) {
      updateData.blog_password_encrypted = encryptBlogPassword(updateData.blog_password_encrypted);
    }

    // Check if all required fields are filled
    const requiredFields = ['name', 'main_services', 'address', 'blog_id', 'blog_board_name'];
    const { data: currentHospital } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', sessionData.id)
      .single();

    if (currentHospital) {
      const allFieldsFilled = requiredFields.every(field => {
        const value = updateData[field] !== undefined ? updateData[field] : currentHospital[field];
        return value !== null && value !== '' && (Array.isArray(value) ? value.length > 0 : true);
      });

      if (allFieldsFilled) {
        updateData.is_initial_setup_complete = true;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', sessionData.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant:', error);
      return NextResponse.json(
        { error: '설정 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const { password_hash, blog_password_encrypted, ...tenantData } = data;
    void password_hash;
    void blog_password_encrypted;

    return NextResponse.json({
      message: '설정이 저장되었습니다.',
      tenant: tenantData,
    });
  } catch (error) {
    console.error('Error in PUT /api/tenant/settings:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
