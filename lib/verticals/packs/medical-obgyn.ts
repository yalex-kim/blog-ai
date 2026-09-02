import type { VerticalPack } from '../types';
import { withImageSlots } from '../image-slot-defaults';

/**
 * Korean obstetrics/gynecology clinics — the vertical this engine started as.
 *
 * The distinguishing constraint is 의료법 제56조 (의료광고 금지 기준): a clinic
 * may not claim superiority, guarantee outcomes, or state a cure. That is why
 * `bannedPhrases` is short and absolute rather than advisory, and why
 * `researchRules` forbids asserting medical fact without a verified source.
 */
export const medicalObgynPack: VerticalPack = {
  id: 'medical-obgyn',
  label: '산부인과',
  description: '의료법 광고 규정을 지키는 산부인과 병원 블로그',

  terminology: {
    tenantNoun: '병원',
    tenantNameLabel: '병원 이름',
    categoryLabel: '진료과목',
    servicesLabel: '주요 진료 항목',
    audienceNoun: '환자',
    defaultCategory: '산부인과',
    serviceExamples: ['산전 진찰', '자궁근종 진료', '여성 검진'],
  },

  writing: {
    persona: '당신은 한국의 병원 블로그 전문 작가입니다.',
    complianceRules: [
      '의료법 준수: 과대광고 금지, 단정적 표현 금지',
      '치료 효과를 보장하거나 완치를 약속하지 마라',
      '특정 시술이나 약물을 권유하는 형태로 쓰지 마라. 정보 제공에 머물러라',
      '주의사항은 반드시 포함',
    ],
    toneRules: [
      '톤: 따뜻하고 전문적, 환자 입장에서 공감',
      '문체: ~입니다 체, 읽기 쉽게 구어체를 조금씩 섞어서(인데요~)',
    ],
    structureRules: [
      '제목 (궁금증 유발)',
      '도입부 (공감)',
      '본문 (3-4개 섹션, 각 섹션은 ## 헤딩으로 시작)',
      '마무리 (병원 방문 유도, 부드럽게)',
    ],
    lengthGuidance: '길이: 1500-2000자',
    bannedPhrases: ['최고', '유일', '완치', '100%'],
    ctaGuidance: '마무리는 증상이 있다면 진료를 받아보시라는 정도로 부드럽게. 특정 시술 권유는 하지 마라.',
    researchRules: [
      '질환 설명, 증상, 진단 기준, 치료법, 약물 정보 등 의학적 사실을 서술하기 전에 web_search 도구로 반드시 확인하라 (알고 있는 지식만으로 단정하지 마라)',
      'web_search로 실제 확인된 URL만 인용하라. 존재를 확인하지 못한 URL은 절대 만들어내지 마라',
    ],
    seoNote: 'Naver SEO 최적화',
  },

  images: {
    required: ['THUMBNAIL', 'INTRO', 'INFOGRAPHIC', 'CTA'],
    optional: ['EXPLAINER', 'LIFESTYLE', 'WARNING'],
    count: 5,
    slots: withImageSlots({
      EXPLAINER: {
        label: '의학 정보 도해',
        writerGuidance: '질환 구조나 검진 과정을 설명하는 의학 도해. 전문적이고 깔끔하게.',
        template: {
          style: 'Clean, professional medical diagram or 3D-rendered model',
          colors: 'Clinical whites, medical blues, and subtle accent tones',
          elements: 'Clear lines, labeled visuals, accurate anatomy when relevant',
        },
      },
      CTA: {
        label: '진료 안내',
        writerGuidance: '진료나 상담을 부드럽게 권하는 이미지. 환영하는 분위기.',
        template: {
          colors: 'Cool, professional hospital tones with warm human touches',
          elements: 'Modern clinic interior, friendly doctor-patient interaction',
        },
      },
    }),
  },

  // 약학정보원, 식약처, 질병관리청, 학회, 상급종합병원 질환백과 — 의학적 사실을
  // 근거로 삼을 수 있는 국내 1차 출처들.
  imagery: {
    contentDeclaration:
      "MEDICAL EDUCATIONAL CONTENT: This is a professional medical illustration for patient education and healthcare information purposes at a women's health clinic.",
    sceneContext:
      'Create a medical educational image for a Korean obstetrics and gynecology hospital blog post about "{topic}".',
    photoContext: 'Create an educational health and wellness image for a blog post about "{topic}".',
    thumbnailContext:
      'This is a flat graphic design cover image for a Korean obstetrics and gynecology clinic blog post about "{topic}". It is a typographic poster, NOT a photograph and NOT a scene.',
    advertisingRule:
      'MEDICAL ADVERTISING RULE: No superlatives or guarantees (최고, 유일, 완치, 100% and the like). Keep the tone informative and reassuring, never sensational. No nudity, no graphic or clinical imagery — this is a friendly cover image.',
    technicalNotes: [
      'This image is for medical education and patient information purposes only',
      'Content must be clinically accurate, professionally appropriate, and suitable for healthcare settings',
      'Maintain a warm, patient-friendly, and professional medical tone',
      'If the image includes people, ensure natural skin tones, realistic proportions, and appropriate medical context',
      'Use soft, natural lighting and avoid any cartoonish or painterly effects',
      'Never render hospital logos, brand marks, or invented hospital/clinic names; any text that appears must be accurate, meaningful Korean relevant to the content',
      'Focus on educational value and clinical accuracy',
    ],
  },

  trustedDomains: [
    'health.kr', // 약학정보원 - 약물 정보
    'nedrug.mfds.go.kr', // 식약처 의약품안전나라
    'mfds.go.kr', // 식품의약품안전처
    'health.kdca.go.kr', // 질병관리청 국가건강정보포털
    'kogs.or.kr', // 대한산부인과학회
    'amc.seoul.kr', // 서울아산병원 질환백과
    'snuh.org', // 서울대학교병원
    'samsunghospital.com', // 삼성서울병원
    'nhis.or.kr', // 국민건강보험공단
  ],

  topicCategories: [
    {
      key: '정보성',
      description: '건강 정보, 질병 예방, 증상 설명 등 환자들이 궁금해하는 의료 정보',
      example: '임신 초기 증상과 대처법',
    },
    {
      key: '홍보성',
      description: '병원 진료 프로그램, 특화 서비스 등 병원의 강점과 진료 소개',
      example: '우리 병원의 임신 관리 프로그램',
    },
  ],
};
