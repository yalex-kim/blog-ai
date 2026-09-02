import { describe, it, expect } from 'vitest';
import {
  generateImagePrompt,
  parseImageType,
  deriveLocationLabel,
  selectThumbnailStyle,
  THUMBNAIL_LAYOUTS,
  THUMBNAIL_PALETTES,
  THUMBNAIL_HEADLINE_TREATMENTS,
} from './image-prompts';
import { medicalObgynPack } from './verticals/packs/medical-obgyn';

describe('deriveLocationLabel', () => {
  it('prefers the most specific token', () => {
    expect(deriveLocationLabel('경기도 김포시 풍무동 123-4')).toBe('풍무동');
    expect(deriveLocationLabel('서울특별시 광진구 아차산로 100')).toBe('광진구');
    expect(deriveLocationLabel('경기도 고양시 일산로 5')).toBe('고양시');
  });

  it('returns an empty string when there is nothing usable', () => {
    expect(deriveLocationLabel('')).toBe('');
    expect(deriveLocationLabel(null)).toBe('');
    expect(deriveLocationLabel(undefined)).toBe('');
    expect(deriveLocationLabel('123 Main Street')).toBe('');
  });
});

describe('selectThumbnailStyle', () => {
  it('moves the three axes independently rather than in lockstep', () => {
    // The original bug: layout and palette shared one index, so the six layouts
    // could only ever appear with their six matching palettes.
    const combos = new Set<string>();
    const total = THUMBNAIL_LAYOUTS.length * THUMBNAIL_PALETTES.length * THUMBNAIL_HEADLINE_TREATMENTS.length;

    for (let variant = 0; variant < total; variant++) {
      const { layout, palette, treatment } = selectThumbnailStyle(variant);
      combos.add(`${layout.name}|${palette}|${treatment}`);
    }

    expect(combos.size).toBe(total);
  });

  it('changes layout first so consecutive variants never repeat a composition', () => {
    const names = THUMBNAIL_LAYOUTS.map((_, i) => selectThumbnailStyle(i).layout.name);

    expect(new Set(names).size).toBe(THUMBNAIL_LAYOUTS.length);
  });

  it('reaches every layout when rolling at random', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(selectThumbnailStyle().layout.name);

    expect(seen.size).toBe(THUMBNAIL_LAYOUTS.length);
  });
});

describe('parseImageType', () => {
  it('recognises THUMBNAIL in the legacy prefix format', () => {
    expect(parseImageType('THUMBNAIL|자궁근종 초음파')).toEqual({
      type: 'THUMBNAIL',
      description: '자궁근종 초음파',
    });
  });
});

describe('generateImagePrompt for THUMBNAIL', () => {
  const branding = { tenantName: '패트라산부인과', location: '풍무동', variant: 0 };

  it('builds a title-card prompt rather than a photographic one', () => {
    const prompt = generateImagePrompt(
medicalObgynPack,
'THUMBNAIL', '자궁근종', '자궁근종 초음파', undefined, branding);

    expect(prompt).toContain('KOREAN BLOG TITLE CARD');
    expect(prompt).toContain('자궁근종 초음파');
    expect(prompt).not.toContain('DSLR');
  });

  it('prints the real clinic footer verbatim and forbids invented names', () => {
    const prompt = generateImagePrompt(
medicalObgynPack,
'THUMBNAIL', '자궁근종', '자궁근종 초음파', undefined, branding);

    expect(prompt).toContain('"풍무동, 패트라산부인과"');
    expect(prompt).toContain('Do NOT invent any 병원');
  });

  it('omits the footer entirely when the clinic is unknown', () => {
    const prompt = generateImagePrompt(
medicalObgynPack,
'THUMBNAIL', '자궁근종', '자궁근종 초음파', undefined, { variant: 0 });

    expect(prompt).toContain('Do not add any 병원 name or footer line');
    expect(prompt).not.toContain('Reproduce this text exactly');
  });

  it('uses the supplied text as the subtitle', () => {
    const prompt = generateImagePrompt(
medicalObgynPack,
'THUMBNAIL',
      '자궁근종',
      '자궁근종 초음파',
      '생리량이 많아졌다면 꼭 확인하세요',
      branding
    );

    expect(prompt).toContain('Subtitle');
    expect(prompt).toContain('생리량이 많아졌다면 꼭 확인하세요');
  });

  it('gives every variant a distinct composition, not just distinct ornaments', () => {
    const prompts = THUMBNAIL_LAYOUTS.map((_, i) =>
      generateImagePrompt(
medicalObgynPack,
'THUMBNAIL', '자궁근종', '자궁근종 초음파', undefined, { variant: i })
    );

    expect(new Set(prompts).size).toBe(THUMBNAIL_LAYOUTS.length);
    THUMBNAIL_LAYOUTS.forEach((layout, i) => {
      expect(prompts[i]).toContain(layout.composition);
      expect(prompts[i]).toContain(layout.decoration);
    });
  });

  it('does not pin the card to a centred stack', () => {
    const prompt = generateImagePrompt(
medicalObgynPack,
'THUMBNAIL', '자궁근종', '자궁근종 초음파', undefined, branding);

    expect(prompt).not.toContain('Centre-align the text block');
    expect(prompt).toContain('do not default to a centred stack');
  });

  it('wraps out-of-range variants instead of producing an undefined layout', () => {
    const prompt = generateImagePrompt(
medicalObgynPack,
'THUMBNAIL', '자궁근종', '자궁근종 초음파', undefined, {
      variant: THUMBNAIL_LAYOUTS.length + 2,
    });

    expect(prompt).not.toContain('undefined');
    expect(prompt).toContain(THUMBNAIL_LAYOUTS[2].composition);
  });

  it('leaves the other types on the photographic template', () => {
    const prompt = generateImagePrompt(
medicalObgynPack,
'INTRO', '자궁근종', '햇살이 비치는 방', undefined, branding);

    expect(prompt).toContain('DSLR');
    expect(prompt).not.toContain('KOREAN BLOG TITLE CARD');
    expect(prompt).not.toContain('패트라산부인과');
  });
});
