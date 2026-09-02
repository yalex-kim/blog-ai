import type { ImageType, VerticalPack } from './types';

/** The tenant facts a prompt needs. Mirrors the columns `tenants` exposes. */
export interface TenantContext {
  name: string;
  category: string;
  address?: string | null;
  mainServices?: string[] | null;
}

/**
 * The image-suggestion block is the most brittle part of the prompt: the exact
 * `[#n | TYPE | 묘사 | text : ...]` shape it describes is what
 * `parseImageSuggestions` reads back out. Generating it from the pack rather
 * than hand-writing it per industry keeps the format in one place while the
 * slot *meanings* stay the pack's to define.
 */
function buildImageSection(pack: VerticalPack): string {
  const { required, optional, count, slots } = pack.images;
  const optionalLabel = optional.join(', ');
  // THUMBNAIL is called out separately below because it also has a fixed
  // position (#1, right under the title), so it is excluded here.
  const otherRequired = required.filter((type) => type !== 'THUMBNAIL');
  const requiredLabel = otherRequired.map((type) => `${type} 1개`).join(', ');
  const remaining = count - required.length;

  const typeLines = [...required, ...optional].map(
    (type) => `     * ${type} (${slots[type].label}): ${slots[type].writerGuidance}`
  );

  const sceneOnly = (Object.keys(slots) as ImageType[]).filter(
    (type) => !slots[type].hasTextOverlay
  );
  const withText = (Object.keys(slots) as ImageType[]).filter(
    (type) => type !== 'THUMBNAIL' && slots[type].hasTextOverlay
  );

  return [
    `이미지 제안 (필수 - 정확히 ${count}개):`,
    `   - 본문에 정확히 ${count}개의 이미지 제안을 [#번호 | Type | 이미지 묘사 설명 | text : 텍스트내용] 형식으로 삽입`,
    `   - 번호는 반드시 ${Array.from({ length: count }, (_, i) => `#${i + 1}`).join(', ')} 순서대로 작성 (글마다 고유 식별자)`,
    `   - 필수 타입: THUMBNAIL 1개(반드시 #1, 글 맨 앞 제목 바로 아래), ${requiredLabel}` +
      (remaining > 0 ? ` (나머지 ${remaining}개는 ${optionalLabel} 중 선택)` : ''),
    '   - Type 설명:',
    ...typeLines,
    '   - 형식 규칙:',
    '     * THUMBNAIL: 묘사 자리에는 카드에 크게 들어갈 핵심 키워드(2줄로 나눌 수 있는 6-10자)를, text 자리에는 부제 한 줄(15-25자)을 쓴다',
    `     * ${sceneOnly.join('와 ')}: text 부분 없이 장면만 표현`,
    `     * ${withText.join(', ')}: text 부분에 이미지에 들어갈 텍스트 포함`,
    '   - 이미지 묘사 설명: 이미지에 그려질 시각적 장면이나 요소를 구체적으로 설명',
    `   - text : 이미지에 오버레이될 한글 텍스트 (10-30자, ${sceneOnly.join('/')} 제외)`,
    '   - 각 주요 섹션마다 관련 이미지 제안을 배치',
  ].join('\n');
}

function buildReferenceSection(pack: VerticalPack): string {
  return [
    '신뢰할 수 있는 자료 활용:',
    ...pack.writing.researchRules.map((rule) => `   - ${rule}`),
    '   - 관련 자료를 찾지 못했다면 그 사실을 본문에 드러내지 말고, 참고자료 항목에서 조용히 생략하라',
    '   - 글의 맨 마지막(이미지 제안 다음 줄)에 실제로 검색해서 확인한 자료만 아래 형식으로 정리하라. 확인된 자료가 하나도 없으면 이 섹션 자체를 생략하라:',
    '     [참고자료]',
    '     - 출처명: 실제 URL',
    '     - 출처명: 실제 URL',
  ].join('\n');
}

/**
 * Compose the post-generation system prompt for one vertical.
 *
 * Rules are emitted as a numbered list in a fixed order — compliance first,
 * banned words and the image contract last — because that order is what the
 * clinic prompt was tuned against and reordering it measurably changes what
 * the model prioritizes when the rules conflict.
 */
export function buildBlogSystemPrompt(pack: VerticalPack): string {
  const { writing } = pack;

  const rules: string[] = [
    ...writing.complianceRules,
    ...writing.toneRules,
    `구조:\n${writing.structureRules.map((step) => `   - ${step}`).join('\n')}`,
    writing.lengthGuidance,
    writing.ctaGuidance,
    `절대 금지 표현: ${writing.bannedPhrases.map((phrase) => `"${phrase}"`).join(', ')} 등`,
    buildImageSection(pack),
    writing.seoNote,
    buildReferenceSection(pack),
  ];

  return [
    writing.persona,
    '',
    '다음 규칙을 반드시 준수하세요:',
    ...rules.map((rule, index) => `${index + 1}. ${rule}`),
  ].join('\n');
}

/** The per-request user message: who this post is for. */
export function buildBlogUserMessage(
  pack: VerticalPack,
  tenant: TenantContext,
  topic: string,
  keywords?: string
): string {
  const { terminology } = pack;
  const lines = [
    `${terminology.tenantNameLabel} : ${tenant.name}`,
    `${terminology.categoryLabel} : ${tenant.category}`,
  ];
  if (tenant.address) lines.push(`${terminology.tenantNoun} 위치 : ${tenant.address}`);
  if (tenant.mainServices?.length) {
    lines.push(`${terminology.servicesLabel} : ${tenant.mainServices.join(', ')}`);
  }
  lines.push(`주제 : ${topic}`);
  if (keywords?.trim()) lines.push(`키워드 : ${keywords.trim()}`);
  return lines.join('\n');
}

/** Prompt for the topic recommender, built from the pack's categories. */
export function buildTopicPrompt(
  pack: VerticalPack,
  tenant: TenantContext,
  recentTopics: string
): string {
  const { terminology, topicCategories } = pack;
  const perCategory = 5;

  const categoryBlocks = topicCategories.map(
    (category, index) =>
      `${index + 1}. ${category.key} 주제 (${category.description}):\n   - 예: "${category.example}"`
  );

  const responseFormat = topicCategories
    .map(
      (category) =>
        `[${category.key}]\n${Array.from({ length: perCategory }, (_, i) => `${i + 1}. 주제명`).join('\n')}`
    )
    .join('\n\n');

  return `당신은 ${tenant.category} 전문 블로그 주제 추천 전문가입니다.

${terminology.tenantNoun} 정보:
- ${terminology.tenantNameLabel}: ${tenant.name}
- ${terminology.categoryLabel}: ${tenant.category}
- ${terminology.servicesLabel}: ${tenant.mainServices?.join(', ') || '없음'}
- 최근 작성한 글 주제: ${recentTopics}

다음 ${topicCategories.length}개 카테고리로 각 ${perCategory}개씩, 총 ${topicCategories.length * perCategory}개의 블로그 주제를 추천해주세요:

${categoryBlocks.join('\n\n')}

응답 형식:
${responseFormat}

주의사항:
- 최근 작성한 주제와 중복되지 않게
- 계절/시기를 고려
- 실용적이고 ${terminology.audienceNoun}이(가) 관심 가질 만한 주제
- ${tenant.category} 전문 내용으로`;
}
