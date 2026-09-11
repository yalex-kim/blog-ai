import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getImagesForPost } from '@/lib/image-storage';
import { getSession } from '@/lib/session';
import { isTrustedOrigin } from '@/lib/request-security';

// GET: Fetch recent blog posts (최근 10개)
export async function GET(request: NextRequest) {
  try {
    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('id, title, topic, created_at, content, image_keywords, reference_links')
      .eq('tenant_id', sessionData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json({ error: '글 목록을 불러오는데 실패했습니다.' }, { status: 500 });
    }

    // Fetch images for each post
    const postsWithImages = await Promise.all(
      (posts || []).map(async (post) => {
        const images = await getImagesForPost(post.id);
        return {
          ...post,
          images: images.map((img) => ({
            keyword: img.keyword,
            text: img.text_content,
            url: img.public_url,
            prompt: img.prompt,
            type: img.image_type,
            displayOrder: img.display_order,
            promptId: img.prompt_id,
          })),
        };
      })
    );

    return NextResponse.json({ posts: postsWithImages });
  } catch (error) {
    console.error('Error in GET /api/blog-posts:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: Update blog post content
export async function PUT(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { id, content } = await request.json();

    if (!id || typeof id !== 'string' || !content || typeof content !== 'string') {
      return NextResponse.json({ error: '글 ID와 내용을 입력해주세요.' }, { status: 400 });
    }

    // Verify ownership
    const { data: post } = await supabaseAdmin
      .from('blog_posts')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!post || post.tenant_id !== sessionData.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // Update content
    const { error } = await supabaseAdmin
      .from('blog_posts')
      .update({ content })
      .eq('id', id);

    if (error) {
      console.error('Error updating post:', error);
      return NextResponse.json({ error: '글 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ message: '저장되었습니다.' });
  } catch (error) {
    console.error('Error in PUT /api/blog-posts:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE: remove a post, its images, and the files behind them
export async function DELETE(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: '글 ID를 입력해주세요.' }, { status: 400 });
    }

    const { data: post } = await supabaseAdmin
      .from('blog_posts')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!post || post.tenant_id !== sessionData.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // The blog_images rows go with the post through ON DELETE CASCADE, but the
    // files in Storage have no foreign key and would be orphaned — paid-for
    // bytes nobody can reach. Remove them first, and in one call rather than
    // per image.
    const images = await getImagesForPost(id);
    const paths = images.map((image) => image.storage_path).filter(Boolean);

    if (paths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('blog-images')
        .remove(paths);
      // A storage failure must not strand the post: the row is what the user
      // asked to be rid of, and an orphaned file is recoverable where a
      // half-deleted post is confusing.
      if (storageError) {
        console.error('[blog-posts] failed to remove images from storage', storageError);
      }
    }

    const { error } = await supabaseAdmin.from('blog_posts').delete().eq('id', id);

    if (error) {
      console.error('Error deleting post:', error);
      return NextResponse.json({ error: '글 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ message: '삭제되었습니다.', deletedImages: paths.length });
  } catch (error) {
    console.error('Error in DELETE /api/blog-posts:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
