import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { extractCitedSnippets } from './extract-citations';

function textBlock(citations: Anthropic.TextCitation[] | null): Anthropic.TextBlock {
  return { type: 'text', text: '...', citations };
}

function webCitation(
  overrides: Partial<Anthropic.CitationsWebSearchResultLocation> = {}
): Anthropic.CitationsWebSearchResultLocation {
  return {
    type: 'web_search_result_location',
    url: 'https://health.kr/example',
    title: '약학정보원',
    cited_text: '이 약은 자궁근종 치료에 사용됩니다.',
    encrypted_index: 'idx',
    ...overrides,
  };
}

describe('extractCitedSnippets', () => {
  it('returns an empty map when there are no citations', () => {
    const content: Anthropic.ContentBlock[] = [textBlock(null)];
    expect(extractCitedSnippets(content).size).toBe(0);
  });

  it('extracts web_search_result_location citations keyed by url', () => {
    const content: Anthropic.ContentBlock[] = [textBlock([webCitation()])];
    const result = extractCitedSnippets(content);

    expect(result.size).toBe(1);
    expect(result.get('https://health.kr/example')).toEqual({
      url: 'https://health.kr/example',
      title: '약학정보원',
      snippets: ['이 약은 자궁근종 치료에 사용됩니다.'],
    });
  });

  it('ignores non-web-search citation types (e.g. document citations)', () => {
    const content: Anthropic.ContentBlock[] = [
      textBlock([
        {
          type: 'char_location',
          cited_text: '문서 인용',
          document_index: 0,
          document_title: null,
          file_id: null,
          start_char_index: 0,
          end_char_index: 10,
        },
      ]),
    ];
    expect(extractCitedSnippets(content).size).toBe(0);
  });

  it('collects every distinct cited_text when the same url is cited multiple times', () => {
    const content: Anthropic.ContentBlock[] = [
      textBlock([webCitation({ cited_text: '첫 번째 인용' })]),
      textBlock([webCitation({ cited_text: '두 번째 인용' })]),
    ];
    const result = extractCitedSnippets(content);
    expect(result.get('https://health.kr/example')?.snippets).toEqual(['첫 번째 인용', '두 번째 인용']);
  });

  it('does not duplicate an identical cited_text seen more than once', () => {
    const content: Anthropic.ContentBlock[] = [
      textBlock([webCitation({ cited_text: '같은 인용' })]),
      textBlock([webCitation({ cited_text: '같은 인용' })]),
    ];
    const result = extractCitedSnippets(content);
    expect(result.get('https://health.kr/example')?.snippets).toEqual(['같은 인용']);
  });

  it('dedupes multiple distinct urls', () => {
    const content: Anthropic.ContentBlock[] = [
      textBlock([
        webCitation({ url: 'https://health.kr/a', title: 'A' }),
        webCitation({ url: 'https://health.kr/b', title: 'B' }),
      ]),
    ];
    const result = extractCitedSnippets(content);
    expect(result.size).toBe(2);
    expect([...result.keys()].sort()).toEqual(['https://health.kr/a', 'https://health.kr/b']);
  });
});
