import { describe, it, expect } from 'vitest';
import { getVertical, isKnownVertical, listVerticals } from './registry';
import { genericPack } from './packs/generic';
import { medicalObgynPack } from './packs/medical-obgyn';
import { childDevelopmentPack } from './packs/child-development';
import { IMAGE_TYPES, resolveImageType, type VerticalPack } from './types';
import { withImageSlots, DEFAULT_IMAGE_SLOTS } from './image-slot-defaults';
import { buildBlogSystemPrompt, buildBlogUserMessage, buildTopicPrompt } from './build-blog-prompt';
import { parseImageSuggestions } from '../parse-image-suggestions';

const ALL_PACKS: VerticalPack[] = [genericPack, medicalObgynPack, childDevelopmentPack];

describe('registry', () => {
  it('resolves a known vertical', () => {
    expect(getVertical('child-development').id).toBe('child-development');
  });

  it('falls back to the generic pack rather than throwing on an unknown id', () => {
    // A tenant row can name a pack that was renamed or removed. Losing the
    // industry voice beats 500ing their dashboard.
    expect(getVertical('does-not-exist').id).toBe(genericPack.id);
    expect(getVertical(null).id).toBe(genericPack.id);
    expect(getVertical(undefined).id).toBe(genericPack.id);
  });

  it('reports which ids are real, so callers can validate before persisting', () => {
    expect(isKnownVertical('medical-obgyn')).toBe(true);
    expect(isKnownVertical('does-not-exist')).toBe(false);
  });

  it('lists every pack for the admin picker', () => {
    expect(listVerticals().map((v) => v.id)).toEqual(ALL_PACKS.map((p) => p.id));
  });
});

describe('pack invariants', () => {
  it.each(ALL_PACKS)('$id declares a coherent image budget', (pack) => {
    const { required, optional, count } = pack.images;

    expect(required[0]).toBe('THUMBNAIL');
    expect(required.length).toBeLessThanOrEqual(count);
    expect(new Set(required).size).toBe(required.length);
    expect(required.filter((type) => optional.includes(type))).toEqual([]);
    [...required, ...optional].forEach((type) => {
      expect(IMAGE_TYPES).toContain(type);
    });
  });

  it.each(ALL_PACKS)('$id defines every image slot', (pack) => {
    IMAGE_TYPES.forEach((type) => {
      expect(pack.images.slots[type]).toBeDefined();
      expect(pack.images.slots[type].template.style).toBeTruthy();
    });
  });

  it.each(ALL_PACKS)('$id has at least one topic category with a distinct key', (pack) => {
    expect(pack.topicCategories.length).toBeGreaterThan(0);
    const keys = pack.topicCategories.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives each pack a unique id', () => {
    const ids = ALL_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('withImageSlots', () => {
  it('keeps unspecified template fields from the default', () => {
    const slots = withImageSlots({ WARNING: { template: { colors: 'amber only' } } });

    expect(slots.WARNING.template.colors).toBe('amber only');
    expect(slots.WARNING.template.style).toBe(DEFAULT_IMAGE_SLOTS.WARNING.template.style);
    expect(slots.INTRO).toEqual(DEFAULT_IMAGE_SLOTS.INTRO);
  });

  it('lets a pack drop the camera direction by overriding it with undefined', () => {
    // The child-development pack renders children as illustration, so INTRO
    // must not carry the default DSLR instruction.
    expect(childDevelopmentPack.images.slots.INTRO.template.camera).toBeUndefined();
    expect(DEFAULT_IMAGE_SLOTS.INTRO.template.camera).toBeTruthy();
  });
});

describe('resolveImageType', () => {
  it('accepts current slot names, case-insensitively', () => {
    expect(resolveImageType('intro')).toBe('INTRO');
    expect(resolveImageType(' CTA ')).toBe('CTA');
  });

  it('maps the historical MEDICAL slot onto EXPLAINER', () => {
    // Posts written before the rename still carry [#n | MEDICAL | ...].
    expect(resolveImageType('MEDICAL')).toBe('EXPLAINER');
  });

  it('falls back to EXPLAINER for anything unrecognised', () => {
    expect(resolveImageType('NONSENSE')).toBe('EXPLAINER');
  });
});

describe('buildBlogSystemPrompt', () => {
  it.each(ALL_PACKS)('$id states the image contract the parser reads back', (pack) => {
    const prompt = buildBlogSystemPrompt(pack);

    expect(prompt).toContain('[#번호 | Type | 이미지 묘사 설명 | text : 텍스트내용]');
    expect(prompt).toContain(`정확히 ${pack.images.count}개`);
    pack.images.required.forEach((type) => expect(prompt).toContain(type));
  });

  it('emits a format example the shared parser can actually read', () => {
    // Guards the one coupling that silently breaks everything: the prompt
    // describes a format, and parse-image-suggestions has to accept it.
    const parsed = parseImageSuggestions(
      '[#1 | THUMBNAIL | 자궁근종 초음파검사 | text : 생리량이 많아졌다면 확인하세요]\n' +
        '[#2 | INTRO | 햇살이 비치는 방에 앉아 있는 모습]'
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ id: '1', type: 'THUMBNAIL', text: '생리량이 많아졌다면 확인하세요' });
    expect(parsed[1]).toMatchObject({ id: '2', type: 'INTRO', text: '' });
  });

  it.each(ALL_PACKS)('$id lists its own banned phrases', (pack) => {
    const prompt = buildBlogSystemPrompt(pack);
    pack.writing.bannedPhrases.forEach((phrase) => expect(prompt).toContain(phrase));
  });

  it('carries the clinic pack’s 의료법 framing', () => {
    const prompt = buildBlogSystemPrompt(medicalObgynPack);

    expect(prompt).toContain('의료법 준수');
    expect(prompt).toContain('완치');
    expect(prompt).toContain('병원 블로그 전문 작가');
  });

  it('carries the development-centre pack’s no-diagnosis framing instead', () => {
    const prompt = buildBlogSystemPrompt(childDevelopmentPack);

    expect(prompt).toContain('센터는 의료기관이 아니다');
    expect(prompt).toContain('전문의');
    expect(prompt).not.toContain('의료법 준수');
    expect(prompt).not.toContain('산부인과');
  });

  it('names only the scene slots as text-free', () => {
    const prompt = buildBlogSystemPrompt(medicalObgynPack);

    expect(prompt).toContain('INTRO와 LIFESTYLE: text 부분 없이 장면만 표현');
  });
});

describe('buildBlogUserMessage', () => {
  it('labels tenant facts in the pack’s own vocabulary', () => {
    const message = buildBlogUserMessage(
      childDevelopmentPack,
      { name: '온브레인', category: '아동·청소년 발달센터', address: '서울시 광진구', mainServices: ['ADHD', '언어지연'] },
      '36개월 언어지연'
    );

    expect(message).toContain('센터 이름 : 온브레인');
    expect(message).toContain('전문 분야 : 아동·청소년 발달센터');
    expect(message).toContain('주요 프로그램 : ADHD, 언어지연');
    expect(message).toContain('주제 : 36개월 언어지연');
    expect(message).not.toContain('병원');
  });

  it('omits optional lines rather than printing empty labels', () => {
    const message = buildBlogUserMessage(genericPack, { name: '가게', category: '일반' }, '주제');

    expect(message).not.toContain('위치');
    expect(message).not.toContain('주요 서비스');
    expect(message).not.toContain('키워드');
  });
});

describe('buildTopicPrompt', () => {
  it('asks for exactly the pack’s categories', () => {
    const prompt = buildTopicPrompt(
      childDevelopmentPack,
      { name: '온브레인', category: '아동·청소년 발달센터', mainServices: ['ADHD'] },
      '없음'
    );

    childDevelopmentPack.topicCategories.forEach((category) => {
      expect(prompt).toContain(`[${category.key}]`);
      expect(prompt).toContain(category.example);
    });
    expect(prompt).toContain('총 15개');
    expect(prompt).toContain('보호자');
  });

  it('keeps the clinic pack on its two original categories', () => {
    const prompt = buildTopicPrompt(medicalObgynPack, { name: '병원', category: '산부인과' }, '없음');

    expect(prompt).toContain('[정보성]');
    expect(prompt).toContain('[홍보성]');
    expect(prompt).toContain('총 10개');
  });
});
