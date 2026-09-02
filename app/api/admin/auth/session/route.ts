import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const sessionData = getAdminSession(request);

    if (!sessionData) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        id: sessionData.id,
        username: sessionData.username,
        role: sessionData.role,
      },
    });
  } catch (error) {
    console.error('Error checking admin session:', error);
    return NextResponse.json(
      { error: '세션 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
