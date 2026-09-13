import { describe, expect, it } from 'vitest';
import {
  parseImageSuggestions,
  toEditableContent,
  fromEditableContent,
} from './parse-image-suggestions';

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

describe('editor round-trip', () => {
  const article = `# 제목

본문 첫 문단입니다.

[#1 | THUMBNAIL | 진료실에서 상담하는 장면 | text : 첫 방문 안내]

본문 둘째 문단입니다.

[#2 | INTRO | 밝은 대기실]
`;

  it('replaces markers with a readable placeholder', () => {
    const editable = toEditableContent(article);
    expect(editable).toContain('⟦이미지 1⟧');
    expect(editable).toContain('⟦이미지 2⟧');
    expect(editable).not.toContain('THUMBNAIL');
    expect(editable).not.toContain('text :');
  });

  it('restores the markers unchanged when nothing was edited', () => {
    const suggestions = parseImageSuggestions(article);
    const restored = fromEditableContent(toEditableContent(article), suggestions);
    expect(parseImageSuggestions(restored)).toEqual(parseImageSuggestions(article));
  });

  it('keeps a placeholder the author moved, at its new position', () => {
    const editable = toEditableContent(article).replace('⟦이미지 2⟧', '').replace(
      '본문 첫 문단입니다.',
      '⟦이미지 2⟧\n\n본문 첫 문단입니다.'
    );
    const restored = fromEditableContent(editable, parseImageSuggestions(article));
    const ids = parseImageSuggestions(restored).map((s) => s.id);
    expect(ids).toEqual(['2', '1']);
  });

  it('takes the wording from the cards, which is where it is edited', () => {
    const edited = parseImageSuggestions(article).map((s) =>
      s.id === '1' ? { ...s, description: '새로운 묘사' } : s
    );
    const restored = fromEditableContent(toEditableContent(article), edited);
    expect(restored).toContain('새로운 묘사');
    expect(restored).not.toContain('진료실에서 상담하는 장면');
  });

  it('drops a placeholder whose image was removed', () => {
    const restored = fromEditableContent(toEditableContent(article), [
      parseImageSuggestions(article)[0],
    ]);
    expect(parseImageSuggestions(restored).map((s) => s.id)).toEqual(['1']);
    expect(restored).not.toContain('⟦이미지 2⟧');
  });
});
