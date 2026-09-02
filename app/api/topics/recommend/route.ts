import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { getSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { isTrustedOrigin } from '@/lib/request-security';
import { getVertical } from '@/lib/verticals/registry';
import { buildTopicPrompt } from '@/lib/verticals/build-blog-prompt';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { allowed, retryAfterSeconds } = checkRateLimit(
      `topics-recommend:${sessionData.id}`,
      20,
      60 * 60 * 1000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    // Get tenant info
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', sessionData.id)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Get recent blog posts
    const { data: recentPosts } = await supabaseAdmin
      .from('blog_posts')
      .select('title, topic, created_at')
      .eq('tenant_id', sessionData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentTopics = recentPosts?.map(p => p.topic).join(', ') || '없음';

    const pack = getVertical(tenant.vertical);

    const prompt = buildTopicPrompt(
      pack,
      {
        name: tenant.name || pack.terminology.tenantNoun,
        category: tenant.category || pack.terminology.defaultCategory,
        address: tenant.address,
        mainServices: tenant.main_services,
      },
      recentTopics
    );

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      // Simple structured list generation — no reasoning depth needed, and
      // thinking (on by default for this model) was pushing content past
      // content[0] below, silently emptying the parsed topic lists.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Each category is delimited by its own [key] header and runs until the
    // next one, so the parser is built from the pack rather than hard-coding
    // a 정보성/홍보성 pair.
    const parseTopics = (text: string) =>
      text
        .split('\n')
        .filter((line) => /^\d+\./.test(line.trim()))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);

    const keys = pack.topicCategories.map((category) => category.key);
    const topics: Record<string, string[]> = {};

    keys.forEach((key, index) => {
      const next = keys[index + 1];
      const pattern = new RegExp(
        `\\[${key}\\]([\\s\\S]*?)(?=${next ? `\\[${next}\\]|` : ''}$)`
      );
      const match = content.match(pattern);
      topics[key] = match ? parseTopics(match[1]) : [];
    });

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Error recommending topics:', error);
    return NextResponse.json(
      { error: '주제 추천 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
