import { describe, expect, it } from 'vitest';
import { parseImageSuggestions } from './parse-image-suggestions';

describe('parseImageSuggestions', () => {
  it('parses INTRO/LIFESTYLE entries without a text field', () => {
    const content = '[#1 | INTRO | 창가에 앉아 배를 감싸쥔 여성의 모습]';
    const result = parseImageSuggestions(content);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '1', type: 'INTRO', description: '창가에 앉아 배를 감싸쥔 여성의 모습', text: '' });
  });

  it('parses entries with a text overlay', () => {
    const content = '[#2 | INFOGRAPHIC | 체크리스트 이미지 | text : 1. 배가 아프다 2. 생리량이 많다]';
    const result = parseImageSuggestions(content);
    expect(result[0]).toMatchObject({
      id: '2',
      type: 'INFOGRAPHIC',
      description: '체크리스트 이미지',
      text: '1. 배가 아프다 2. 생리량이 많다',
    });
  });

  it('extracts multiple suggestions in document order', () => {
    const content = `
      본문 시작
      [#1 | INTRO | 도입부 장면]
      본문 중간
      [#2 | MEDICAL | 진료 장면 | text : 검진 안내]
      결론
      [#3 | CTA | 상담 유도 | text : 지금 상담하세요]
    `;
    const result = parseImageSuggestions(content);
    expect(result.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('caps results at the given limit', () => {
    const content = Array.from({ length: 7 }, (_, i) => `[#${i + 1} | MEDICAL | 장면 ${i + 1}]`).join('\n');
    const result = parseImageSuggestions(content, 5);
    expect(result).toHaveLength(5);
  });
});
