import type { VerticalPack } from '../types';
import { withImageSlots } from '../image-slot-defaults';

/**
 * 아동·청소년 발달센터 — ADHD, 틱, 발달지연, 사회성, 학습지연, 언어지연, 자폐,
 * 특수체육, 양육코칭을 다루는 사설 발달센터.
 *
 * Two constraints shape this pack, and both differ from the clinic pack:
 *
 * 1. A development centre is not a 의료기관. It cannot diagnose. Posts that
 *    read as "these signs mean your child has ADHD" are both wrong and legally
 *    exposed, so `complianceRules` pushes every diagnostic claim toward
 *    "전문의 진단이 필요하다" and forbids outcome guarantees.
 *
 * 2. The reader is the 보호자, and the subject is their child. Language that
 *    labels the child ("자폐아", "정상아") lands very differently here than
 *    clinical language does with an adult patient, so respectful,
 *    person-first phrasing is a written rule rather than a matter of taste.
 *
 * The image slots also depart from the defaults: children are rendered as warm
 * illustration, never as photorealistic DSLR portraits. Synthetic photoreal
 * images of identifiable-looking children are a bad thing to publish under a
 * real centre's name, and illustration reads better for this audience anyway.
 */
export const childDevelopmentPack: VerticalPack = {
  id: 'child-development',
  label: '아동·청소년 발달센터',
  description: 'ADHD·틱·발달지연·언어·사회성·양육코칭을 다루는 발달센터 블로그',

  terminology: {
    tenantNoun: '센터',
    tenantNameLabel: '센터 이름',
    categoryLabel: '전문 분야',
    servicesLabel: '주요 프로그램',
    audienceNoun: '보호자',
    defaultCategory: '아동·청소년 발달센터',
    serviceExamples: [
      'ADHD',
      '틱(TIC)',
      '발달지연',
      '사회성',
      '학습지연',
      '언어지연',
      '자폐',
      '특수체육',
      '양육코칭',
    ],
  },

  writing: {
    persona:
      '당신은 한국의 아동·청소년 발달센터 블로그 전문 작가입니다. 발달이 걱정되는 아이의 보호자가 읽는다는 것을 항상 염두에 두세요.',
    complianceRules: [
      '센터는 의료기관이 아니다. 진단을 내리지 마라 — "이런 증상이면 ADHD입니다" 같은 단정 대신 "이런 모습이 반복된다면 전문가 상담을 받아보시는 것이 좋습니다"로 쓴다',
      '치료 효과나 호전을 보장하지 마라. 아이마다 속도가 다르다는 점을 반드시 함께 적는다',
      '의학적 진단·약물 치료가 필요한 영역은 소아청소년과 또는 소아정신건강의학과 전문의 진료를 함께 권하라. 센터 프로그램이 의료를 대체한다는 인상을 주지 마라',
      '보호자의 양육 방식을 원인으로 지목하거나 죄책감을 유발하는 서술을 하지 마라',
      '아이를 진단명으로 부르지 마라: "자폐아", "ADHD 아이", "정상아" 대신 "자폐 스펙트럼 특성이 있는 아이", "또래와 발달 속도가 다른 아이"처럼 아이를 앞에 두고 표현한다',
    ],
    toneRules: [
      '톤: 불안한 보호자를 안심시키는 따뜻함과, 근거를 짚어주는 전문성을 함께',
      '겁을 주어 상담을 유도하지 마라. 걱정을 키우는 대신 다음에 무엇을 해볼 수 있는지를 알려준다',
      '문체: ~입니다 체, 읽기 쉽게 구어체를 조금씩 섞어서(인데요~)',
      '전문 용어는 쓰되 반드시 쉬운 말로 풀어서 함께 적는다',
    ],
    structureRules: [
      '제목 (보호자가 검색창에 칠 법한 고민을 담아서)',
      '도입부 (보호자가 겪고 있을 상황에 공감)',
      '본문 (3-4개 섹션, 각 섹션은 ## 헤딩으로 시작)',
      '집에서 해볼 수 있는 것 (구체적인 행동 1-3가지)',
      '마무리 (상담 안내, 부드럽게)',
    ],
    lengthGuidance: '길이: 1500-2000자',
    bannedPhrases: ['완치', '정상아', '장애아', '100%', '최고', '유일', '무조건 좋아집니다'],
    ctaGuidance:
      '마무리는 "혼자 판단하기 어려우실 때 상담으로 확인해볼 수 있습니다" 정도로. 지금 등록하지 않으면 늦는다는 식의 조급함 유발 표현은 절대 쓰지 마라.',
    researchRules: [
      '발달 이정표, 진단 기준, 유병률, 중재 방법의 효과 등 사실을 서술하기 전에 web_search 도구로 반드시 확인하라 (알고 있는 지식만으로 단정하지 마라)',
      '연령별 발달 기준을 인용할 때는 출처와 기준 연령을 함께 밝혀라',
      'web_search로 실제 확인된 URL만 인용하라. 존재를 확인하지 못한 URL은 절대 만들어내지 마라',
    ],
    seoNote: 'Naver SEO 최적화 (보호자가 실제로 검색하는 구어체 키워드를 본문에 자연스럽게 포함)',
  },

  images: {
    required: ['THUMBNAIL', 'INTRO', 'INFOGRAPHIC', 'CTA'],
    optional: ['EXPLAINER', 'LIFESTYLE', 'WARNING'],
    count: 5,
    slots: withImageSlots({
      INTRO: {
        writerGuidance: '보호자가 겪는 상황에 공감하는 장면. 아이는 일러스트로, 표정은 부정적이지 않게.',
        template: {
          style:
            'Soft, warm children’s-book style illustration with gentle linework (not a photograph, not photorealistic — never render children photorealistically)',
          colors: 'Soft pastel tones (cream, sage, dusty blue, warm peach)',
          mood: 'Warm, patient, hopeful — never sad, clinical, or pitying',
          elements:
            'A parent and child in an everyday home or playroom setting, natural body language, plenty of negative space',
          camera: undefined,
        },
      },
      LIFESTYLE: {
        writerGuidance: '집이나 놀이 상황에서 보호자가 해볼 수 있는 활동 장면.',
        template: {
          style: 'Soft, warm children’s-book style illustration (not a photograph, not photorealistic)',
          colors: 'Bright but gentle tones (sage green, soft yellow, sky blue)',
          mood: 'Playful, encouraging, everyday',
          elements: 'Simple play or learning activity at home, parent participating alongside the child',
          camera: undefined,
        },
      },
      EXPLAINER: {
        label: '발달 개념 도해',
        writerGuidance: '발달 단계, 뇌·행동의 원리, 중재 과정을 한눈에 보여주는 도해.',
        template: {
          style: 'Clean, friendly educational diagram — rounded shapes, no clinical sterility',
          colors: 'Calm sage and soft blue with one warm accent',
          mood: 'Reassuring, clear, easy for a non-expert parent to follow',
          elements:
            'Labeled stages or steps, simple child-friendly icons, developmental timeline when relevant, no anatomical realism',
        },
      },
      WARNING: {
        label: '이럴 땐 확인해보세요',
        writerGuidance: '놓치기 쉬운 신호나 흔한 오해를 짚어주는 이미지. 불안을 키우지 않게.',
        template: {
          colors: 'Soft amber and warm sand — gentle emphasis, never alarm red',
          mood: 'Calm and caring; a nudge to check, not a warning to fear',
        },
      },
      CTA: {
        label: '상담 안내',
        writerGuidance: '센터 상담을 부드럽게 안내하는 이미지. 밝고 편안한 공간.',
        template: {
          style: 'Warm, inviting interior render of a bright child therapy or consultation room',
          colors: 'Natural wood, cream walls, soft green accents',
          mood: 'Safe, calm, welcoming — a place a parent would feel comfortable bringing a child',
          elements:
            'Bright playroom or consultation space with soft furnishings and play materials, no identifiable faces',
        },
      },
    }),
  },

  // 발달·특수교육 영역의 국내 1차 출처. 병원 팩과 달리 교육부·특수교육원 계열이
  // 들어가는데, 이 업종의 근거는 의학 문헌만이 아니라 발달 이정표와 특수교육
  // 지침에서도 나오기 때문이다.
  imagery: {
    contentDeclaration:
      'CHILD DEVELOPMENT EDUCATIONAL CONTENT: This is a warm, respectful illustration for a Korean child-development centre blog that helps parents understand their child.',
    sceneContext:
      'Create a friendly educational image for a Korean child and adolescent development centre blog post about "{topic}".',
    photoContext:
      'Create a warm, hopeful everyday image for a parenting blog post about "{topic}".',
    thumbnailContext:
      'This is a flat graphic design cover image for a Korean child-development centre blog post about "{topic}". It is a typographic poster, NOT a photograph and NOT a scene.',
    advertisingRule:
      'TONE RULE: No superlatives or guarantees (최고, 유일, 완치, 100% and the like). Never depict a child as sad, isolated, ashamed, or as a patient. Nothing that could read as pitying, alarming, or stigmatizing.',
    technicalNotes: [
      'Children must be drawn as warm, stylised illustration — never photorealistic, and never resembling an identifiable real child',
      'Depict children as capable and engaged; avoid clinical, institutional, or hospital-like settings',
      'Show a parent, caregiver, or therapist alongside the child wherever a person appears',
      'Use soft, natural lighting and gentle, rounded shapes',
      'Never render centre logos, brand marks, or invented centre/company names; any text that appears must be accurate, meaningful Korean relevant to the content',
      'No medical equipment, no diagnostic charts about a specific child, no distressing imagery',
    ],
  },

  trustedDomains: [
    'health.kdca.go.kr', // 질병관리청 국가건강정보포털
    'ncmh.go.kr', // 국립정신건강센터
    'broso.or.kr', // 중앙장애아동·발달장애인지원센터
    'nise.go.kr', // 국립특수교육원
    'mohw.go.kr', // 보건복지부
    'kacap.or.kr', // 대한소아청소년정신의학회
    'kaslp.or.kr', // 한국언어재활사협회
    'amc.seoul.kr', // 서울아산병원 질환백과
    'snuh.org', // 서울대학교병원
    'childcare.go.kr', // 아이사랑 (보육·발달 정보)
  ],

  topicCategories: [
    {
      key: '발달정보',
      description: '발달 단계, 신호 구별법, 검사와 진단 절차 등 보호자가 가장 먼저 검색하는 정보',
      example: '36개월인데 말이 늦어요, 언제 검사를 받아야 할까요',
    },
    {
      key: '양육코칭',
      description: '집에서 바로 해볼 수 있는 상호작용·훈육·놀이 방법',
      example: '아이가 지시를 따르지 않을 때 말 거는 법 3가지',
    },
    {
      key: '센터안내',
      description: '센터의 프로그램과 진행 방식, 상담 절차 소개',
      example: '언어치료는 어떻게 진행되나요 — 첫 상담부터 종결까지',
    },
  ],
};
