import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getImagesForPost } from '@/lib/image-storage';
import { getSession } from '@/lib/session';
import { isTrustedOrigin } from '@/lib/request-security';
import { summarisePostCost, type CostableUsageRow } from '@/lib/usage-cost';

// GET: the tenant's posts — a page of them, searchable.
//
// The list deliberately does NOT carry each post's images. It used to: one
// query for the posts and then one per post for its images, eleven round trips
// to render a list of titles. Opening a post fetches its images; the list only
// needs to know how many there are.
const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;

    // ?id= returns one post with its images — what opening a post needs, and
    // the reason the list itself can stay free of them.
    const singleId = params.get('id');
    if (singleId) {
      const { data: post, error: postError } = await supabaseAdmin
        .from('blog_posts')
        .select('id, title, topic, created_at, content, image_keywords, reference_links, posted_to_blog')
        .eq('id', singleId)
        .eq('tenant_id', sessionData.id)
        .single();

      if (postError || !post) {
        return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
      }

      const images = await getImagesForPost(post.id);
      return NextResponse.json({
        post: {
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
        },
      });
    }

    const search = (params.get('q') ?? '').trim().slice(0, 100);
    const offset = Math.max(Number(params.get('offset')) || 0, 0);
    const limit = Math.min(Math.max(Number(params.get('limit')) || PAGE_SIZE, 1), MAX_PAGE_SIZE);

    let query = supabaseAdmin
      .from('blog_posts')
      .select('id, title, topic, created_at, content, image_keywords, reference_links, posted_to_blog', {
        count: 'exact',
      })
      .eq('tenant_id', sessionData.id);

    if (search) {
      // Escape PostgREST's or() delimiters so a comma or paren in the query
      // cannot break out of the filter expression.
      const safe = search.replace(/[,()]/g, ' ');
      query = query.or(`title.ilike.%${safe}%,topic.ilike.%${safe}%`);
    }

    const { data: posts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json({ error: '글 목록을 불러오는데 실패했습니다.' }, { status: 500 });
    }

    const ids = (posts ?? []).map((post) => post.id);

    // Two queries for the whole page, not two per post: how many images each
    // has, and what each cost. Both are scoped to the ids already fetched.
    const [imageRows, usageRows] = await Promise.all([
      ids.length
        ? supabaseAdmin.from('blog_images').select('blog_post_id').in('blog_post_id', ids)
        : Promise.resolve({ data: [] as { blog_post_id: string }[] }),
      ids.length
        ? supabaseAdmin
            .from('usage_events')
            .select(
              'blog_post_id, kind, provider, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, web_search_requests, image_count, image_quality, cost_usd'
            )
            .in('blog_post_id', ids)
        : Promise.resolve({ data: [] as CostableUsageRow[] }),
    ]);

    const imageCounts = new Map<string, number>();
    for (const row of (imageRows.data ?? []) as { blog_post_id: string }[]) {
      imageCounts.set(row.blog_post_id, (imageCounts.get(row.blog_post_id) ?? 0) + 1);
    }

    const usageByPost = new Map<string, CostableUsageRow[]>();
    for (const row of (usageRows.data ?? []) as (CostableUsageRow & { blog_post_id: string | null })[]) {
      if (!row.blog_post_id) continue;
      usageByPost.set(row.blog_post_id, [...(usageByPost.get(row.blog_post_id) ?? []), row]);
    }

    const enriched = (posts ?? []).map((post) => ({
      ...post,
      imageCount: imageCounts.get(post.id) ?? 0,
      // How many slots the post expects, so the list can say "3/5".
      expectedImages: post.image_keywords?.length ?? 0,
      cost: summarisePostCost(usageByPost.get(post.id) ?? []),
    }));

    return NextResponse.json({
      posts: enriched,
      total: count ?? enriched.length,
      offset,
      limit,
      hasMore: offset + enriched.length < (count ?? 0),
    });
  } catch (error) {
    console.error('Error in GET /api/blog-posts:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

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
