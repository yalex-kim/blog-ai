import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/session';

// Get all blog posts for a tenant
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

    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('id, title, topic, created_at, posted_to_blog')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json(
        { error: '블로그 글을 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ posts: posts || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/tenants/[id]/posts:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
