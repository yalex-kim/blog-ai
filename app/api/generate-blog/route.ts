import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { parseImageSuggestions } from '@/lib/parse-image-suggestions';
import { parseReferences } from '@/lib/parse-references';
import { extractCitedSnippets } from '@/lib/extract-citations';
import { extractArticleText } from '@/lib/extract-article-text';
import { buildVerifiedReferences } from '@/lib/build-references';
import { getVertical } from '@/lib/verticals/registry';
import {
  buildBlogSystemPrompt,
  buildBlogUserMessage,
} from '@/lib/verticals/build-blog-prompt';
import { isTrustedOrigin } from '@/lib/request-security';
import {
  resolveApiKey,
  missingKeyMessage,
  KEY_COLUMNS,
  MISSING_API_KEY_CODE,
} from '@/lib/tenant-keys';
import { recordUsage, extractAnthropicUsage } from '@/lib/usage';

const BLOG_MODEL = 'claude-sonnet-4-5-20250929';

const MAX_TOPIC_LENGTH = 200;
const MAX_KEYWORDS_LENGTH = 500;
// Upper bound on web_search calls per generation — each call is billed
// separately from token usage ($10 / 1,000 searches), so this caps the
// added cost per post regardless of how eagerly the model searches.
const MAX_WEB_SEARCH_USES = 4;

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
      `generate-blog:${sessionData.id}`,
      20,
      60 * 60 * 1000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const { topic, keywords } = await request.json();

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json(
        { error: '주제를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (topic.length > MAX_TOPIC_LENGTH) {
      return NextResponse.json(
        { error: `주제는 ${MAX_TOPIC_LENGTH}자 이내로 입력해주세요.` },
        { status: 400 }
      );
    }

    if (keywords !== undefined && (typeof keywords !== 'string' || keywords.length > MAX_KEYWORDS_LENGTH)) {
      return NextResponse.json(
        { error: '키워드 입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // Fetch tenant information, including the tenant's own API key.
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select(
        `name, category, address, main_services, vertical, trusted_domains, ${KEY_COLUMNS.anthropic}`
      )
      .eq('id', sessionData.id)
      .single();

    // BYOK: the tenant's own key pays for this call, and there is no fallback.
    const key = resolveApiKey('anthropic', tenant);
    if (!key) {
      return NextResponse.json(
        { error: missingKeyMessage('anthropic'), code: MISSING_API_KEY_CODE, provider: 'anthropic' },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey: key.apiKey });

    // The pack decides how this post is written; an unknown or missing
    // vertical falls back to the generic pack rather than failing the request.
    const pack = getVertical(tenant?.vertical);

    const tenantContext = {
      name: tenant?.name || pack.terminology.tenantNoun,
      category: tenant?.category || pack.terminology.defaultCategory,
      address: tenant?.address ?? '',
      mainServices: tenant?.main_services ?? [],
    };

    // A tenant's own allowlist wins; otherwise the pack's seed list. An empty
    // list means the pack has no curated sources, so search is left unrestricted
    // rather than being handed an empty allowlist (which would block every result).
    const allowedDomains: string[] = tenant?.trusted_domains?.length
      ? tenant.trusted_domains
      : pack.trustedDomains;

    const message = await anthropic.messages.create({
      model: BLOG_MODEL,
      max_tokens: 10164,
      temperature: 1,
      system: buildBlogSystemPrompt(pack),
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: MAX_WEB_SEARCH_USES,
          ...(allowedDomains.length > 0 ? { allowed_domains: allowedDomains } : {}),
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildBlogUserMessage(pack, tenantContext, topic, keywords),
            },
          ],
        },
      ],
    });

    // With web_search enabled, message.content is a transcript of the
    // server-side loop — see lib/extract-article-text.ts for why the article
    // can't just be every text block concatenated.
    const fullContent = extractArticleText(message.content);

    // Extract image suggestions from content [#번호 | Type | 이미지 묘사 설명 | text : 텍스트내용]
    const imageSuggestions = parseImageSuggestions(fullContent, pack.images.count);

    // 이미지 키워드 추출 (기존 방식 유지)
    const keywordMatch = fullContent.match(/\[이미지 키워드\]([\s\S]*?)(?:\n\n|$)/);
    let imageKeywords: string[] = [];
    let content = fullContent;

    if (keywordMatch) {
      const keywordsText = keywordMatch[1];
      imageKeywords = keywordsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(Boolean);

      // 본문에서 키워드 섹션 제거
      content = fullContent.replace(/\[이미지 키워드\][\s\S]*$/, '').trim();
    }

    // 참고자료는 실제 인용 메타데이터(citations)를 기준으로 만든다. Claude가
    // 직접 적은 "[참고자료]" 목록은 본문에서 제거한 뒤 제목을 다듬는 용도로만
    // 쓴다 — 그 목록은 검색 없이 기억만으로 지어낼 수도 있기 때문에, 실제로
    // 인용된 근거가 없는 출처는 참고자료에 넣지 않는다. 확인된 출처는 정상적인
    // 마크다운 링크로 본문에 다시 삽입해, 글을 그대로 복사/게시해도 출처가
    // 함께 따라가게 한다.
    const referencesResult = parseReferences(content);
    const citedSnippets = extractCitedSnippets(message.content);
    const references = buildVerifiedReferences(referencesResult.references, citedSnippets);

    content = referencesResult.content;
    if (references.length > 0) {
      const referencesMarkdown = [
        '## 참고자료',
        ...references.map((ref) => `- [${ref.title}](${ref.url})`),
      ].join('\n');
      content = `${content}\n\n${referencesMarkdown}`;
    }

    // Extract title from content
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : topic;

    // Save to database
    let blogPostId = null;
    const { data, error } = await supabaseAdmin.from('blog_posts').insert([
      {
        tenant_id: sessionData.id,
        title,
        content,
        topic,
        keywords: keywords?.split(',').map((k: string) => k.trim()) || [],
        image_keywords: imageKeywords,
        reference_links: references,
        posted_to_blog: false,
      },
    ]).select().single();

    if (data && !error) {
      blogPostId = data.id;
    }

    // Metering. Recorded after the post is saved so the row can point at it,
    // and awaited so a serverless instance is not frozen mid-insert.
    await recordUsage({
      tenantId: sessionData.id,
      kind: 'blog_generation',
      provider: 'anthropic',
      model: BLOG_MODEL,
      keySource: key.source,
      blogPostId,
      tokens: extractAnthropicUsage(message.usage),
    });

    return NextResponse.json({
      content,
      imageKeywords,
      references,
      imageSuggestions: imageSuggestions.map(s => ({
        id: s.id,
        type: s.type,
        description: s.description,
        text: s.text,
      })),
      blogPostId,
    });
  } catch (error) {
    console.error('Error generating blog:', error);
    return NextResponse.json(
      { error: '블로그 글 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
