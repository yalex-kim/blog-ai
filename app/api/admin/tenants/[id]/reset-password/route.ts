import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getAdminSession } from '@/lib/session';
import { isTrustedOrigin } from '@/lib/request-security';

// Reset tenant password
export async function POST(
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
    const { new_password } = await request.json();

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return NextResponse.json(
        { error: '8자 이상의 새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(new_password, 10);

    // Update tenant password
    const { error } = await supabaseAdmin
      .from('tenants')
      .update({
        password_hash,
        must_change_password: true, // Force tenant to change on next login
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error resetting password:', error);
      return NextResponse.json(
        { error: '비밀번호 재설정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '비밀번호가 성공적으로 재설정되었습니다.',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/tenants/[id]/reset-password:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
