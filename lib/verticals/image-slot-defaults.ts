import type { ImageType, VerticalImageSlot } from './types';

/**
 * Neutral baseline for every image slot.
 *
 * Packs rarely need to redefine a slot from scratch — a development centre and
 * a clinic both want INTRO to be a warm, shallow-depth-of-field photo. What
 * differs is the subject matter, so packs spread these defaults and override
 * only the fields that carry industry meaning (usually `elements`,
 * `writerGuidance`, and the EXPLAINER/CTA slots wholesale).
 */
export const DEFAULT_IMAGE_SLOTS: Record<ImageType, VerticalImageSlot> = {
  THUMBNAIL: {
    label: '대표 썸네일',
    writerGuidance: '글 맨 앞 제목 바로 아래에 오는 대표 이미지. 제목을 크게 넣은 타이포그래피 카드.',
    hasTextOverlay: true,
    // Built by buildThumbnailPrompt() rather than from this template — the
    // entry exists so the record stays exhaustive over ImageType.
    template: {
      style: '한국형 블로그 타이틀 카드(썸네일): 사진이 아니라 굵은 타이포그래피가 주인공',
      colors: 'One soft background tone with a single saturated accent for the headline',
      mood: 'Friendly, trustworthy, scroll-stopping',
      elements: 'Large two-line Korean headline, small eyebrow line, short subtitle, footer line, decorative frame',
    },
  },

  INTRO: {
    label: '도입부 공감 장면',
    writerGuidance: '독자의 상황에 공감하는 장면. 따뜻하고 친근한 분위기.',
    hasTextOverlay: false,
    template: {
      style: 'Highly realistic natural photo captured with a DSLR camera (not illustration, not digital art, not painting)',
      colors: 'Soft pastel tones (peach, lavender, mint green)',
      mood: 'Warm, calm, empathetic, and reassuring atmosphere',
      elements: 'Natural lighting, shallow depth of field, soft focus, peaceful indoor setting, relatable human subjects',
      camera: 'DSLR 50mm lens, realistic lighting, photo-quality textures',
    },
  },

  EXPLAINER: {
    label: '개념 설명 도해',
    writerGuidance: '본문의 핵심 개념을 시각적으로 풀어주는 도해. 전문적이고 깔끔하게.',
    hasTextOverlay: true,
    template: {
      style: 'Clean, professional explanatory diagram or 3D-rendered model',
      colors: 'Neutral whites, calm blues, and subtle accent tones',
      mood: 'Professional, trustworthy, educational tone',
      elements: 'Clear lines, labeled visuals, accurate structure, no decorative clutter',
    },
  },

  LIFESTYLE: {
    label: '생활 장면',
    writerGuidance: '일상 속 실천 팁이나 생활 가이드를 보여주는 장면. 밝고 실용적으로.',
    hasTextOverlay: false,
    template: {
      style: 'Realistic lifestyle photo captured with a DSLR camera (not illustration, not digital art)',
      colors: 'Bright, energetic tones (fresh greens, soft blues, gentle yellows)',
      mood: 'Positive, healthy, and encouraging atmosphere',
      elements: 'Everyday realistic scenarios, natural body language, approachable environment',
      camera: 'DSLR 35mm lens, daylight, soft shadows',
    },
  },

  WARNING: {
    label: '주의사항',
    writerGuidance: '놓치면 안 되는 주의점이나 오해를 짚어주는 이미지. 겁주지 않으면서 눈에 띄게.',
    hasTextOverlay: true,
    template: {
      style: 'Clean, soft-edged illustration with clear caution symbols',
      colors: 'Soft coral or amber tones for gentle emphasis',
      mood: 'Caring yet cautionary tone, informative without alarming',
      elements: 'Clear icons, balanced composition, smooth gradients',
    },
  },

  CTA: {
    label: '상담 유도',
    writerGuidance: '마무리에서 상담이나 방문을 부드럽게 권하는 이미지. 환영하는 분위기.',
    hasTextOverlay: true,
    template: {
      style: 'Inviting, modern professional environment photo or render',
      colors: 'Cool, professional tones with warm human touches',
      mood: 'Welcoming, professional, and reassuring atmosphere',
      elements: 'Modern interior, friendly staff-visitor interaction',
    },
  },

  INFOGRAPHIC: {
    label: '정보 요약',
    writerGuidance: '체크리스트, 단계, 비교표처럼 구조화된 정보를 한눈에 정리.',
    hasTextOverlay: true,
    template: {
      style: 'Minimalist, icon-based flat infographic',
      colors: '2–3 high-contrast colors for readability',
      mood: 'Clear, structured, and educational tone',
      elements: 'Simple icons, numbered steps, grid layout, minimal decoration',
    },
  },
};

/**
 * Build a pack's slot table from the defaults plus per-slot overrides.
 * Overrides are shallow-merged one level into `template` so a pack can change
 * only `elements` without restating style, colors, and mood.
 */
export function withImageSlots(
  overrides: Partial<Record<ImageType, Partial<Omit<VerticalImageSlot, 'template'>> & { template?: Partial<VerticalImageSlot['template']> }>>
): Record<ImageType, VerticalImageSlot> {
  const result = {} as Record<ImageType, VerticalImageSlot>;
  for (const key of Object.keys(DEFAULT_IMAGE_SLOTS) as ImageType[]) {
    const base = DEFAULT_IMAGE_SLOTS[key];
    const override = overrides[key];
    result[key] = override
      ? { ...base, ...override, template: { ...base.template, ...override.template } }
      : base;
  }
  return result;
}
