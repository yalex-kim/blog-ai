import type { VerticalPack } from '../types';
import { withImageSlots } from '../image-slot-defaults';

/**
 * The fallback pack: a business that publishes a helpful Korean blog and wants
 * readers to get in touch. No industry-specific regulation, no assumed
 * expertise. Useful on its own for unregulated businesses, and as the shape to
 * copy when writing a real pack.
 */
export const genericPack: VerticalPack = {
  id: 'generic',
  label: '일반 업종',
  description: '특별한 광고 규제가 없는 일반 사업자용 기본 팩',

  terminology: {
    tenantNoun: '업체',
    tenantNameLabel: '업체 이름',
    categoryLabel: '업종',
    servicesLabel: '주요 서비스',
    audienceNoun: '고객',
    defaultCategory: '일반',
    serviceExamples: ['대표 서비스', '주력 상품'],
  },

  writing: {
    persona: '당신은 한국의 사업자 블로그 전문 작가입니다.',
    complianceRules: [
      '표시·광고의 공정화에 관한 법률 준수: 객관적 근거 없는 우위 주장 금지',
      '확인되지 않은 수치나 실적을 지어내지 마라',
      '경쟁사를 깎아내리는 표현 금지',
    ],
    toneRules: [
      '톤: 친근하고 신뢰감 있게, 읽는 사람 입장에서 설명',
      '문체: ~입니다 체, 읽기 쉽게 구어체를 조금씩 섞어서(인데요~)',
    ],
    structureRules: [
      '제목 (궁금증 유발)',
      '도입부 (독자의 상황에 공감)',
      '본문 (3-4개 섹션, 각 섹션은 ## 헤딩으로 시작)',
      '마무리 (문의 유도, 부드럽게)',
    ],
    lengthGuidance: '길이: 1500-2000자',
    bannedPhrases: ['최고', '유일', '100%', '무조건'],
    ctaGuidance: '마무리는 부담 없이 문의해도 된다는 뉘앙스로. 강요하는 표현은 쓰지 마라.',
    researchRules: [
      '사실 관계를 서술하기 전에 web_search 도구로 확인하라',
      'web_search로 실제 확인된 URL만 인용하라. 존재를 확인하지 못한 URL은 절대 만들어내지 마라',
    ],
    seoNote: 'Naver SEO 최적화',
  },

  images: {
    required: ['THUMBNAIL', 'INTRO', 'INFOGRAPHIC', 'CTA'],
    optional: ['EXPLAINER', 'LIFESTYLE', 'WARNING'],
    count: 5,
    slots: withImageSlots({}),
  },

  imagery: {
    contentDeclaration:
      'BUSINESS BLOG CONTENT: This is a professional illustration for a Korean business blog that informs and helps readers.',
    sceneContext: 'Create an informative image for a Korean business blog post about "{topic}".',
    photoContext: 'Create a warm, everyday image for a blog post about "{topic}".',
    thumbnailContext:
      'This is a flat graphic design cover image for a Korean business blog post about "{topic}". It is a typographic poster, NOT a photograph and NOT a scene.',
    advertisingRule:
      'ADVERTISING RULE: No superlatives or guarantees (최고, 유일, 100% and the like). Keep the tone informative and friendly, never sensational.',
    technicalNotes: [
      'Maintain a warm, approachable, and professional tone',
      'If the image includes people, ensure natural skin tones and realistic proportions',
      'Use soft, natural lighting',
      'Never render brand logos, brand marks, or invented company names; any text that appears must be accurate, meaningful Korean relevant to the content',
    ],
  },

  trustedDomains: [],

  topicCategories: [
    {
      key: '정보성',
      description: '고객이 궁금해하는 실용 정보',
      example: '처음 방문하기 전에 알아두면 좋은 것들',
    },
    {
      key: '홍보성',
      description: '업체의 강점과 서비스 소개',
      example: '저희가 이 서비스를 준비한 이유',
    },
  ],
};
