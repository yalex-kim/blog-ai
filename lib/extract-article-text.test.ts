import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { extractArticleText } from './extract-article-text';

function text(value: string): Anthropic.TextBlock {
  return { type: 'text', text: value, citations: null };
}

function searchUse(): Anthropic.ContentBlock {
  return {
    type: 'server_tool_use',
    id: 'srvtoolu_1',
    name: 'web_search',
    input: { query: '자궁근종 증상' },
  } as Anthropic.ContentBlock;
}

function searchResult(): Anthropic.ContentBlock {
  return {
    type: 'web_search_tool_result',
    tool_use_id: 'srvtoolu_1',
    content: [],
  } as Anthropic.ContentBlock;
}

describe('extractArticleText', () => {
  it('drops the narration Claude writes before searching', () => {
    const result = extractArticleText([
      text('자궁근종에 대해 신뢰할 수 있는 자료를 검색해보겠습니다.\n\n'),
      searchUse(),
      searchResult(),
      text('# 자궁근종, 이런 증상이 있습니다\n\n본문입니다.'),
    ]);

    expect(result).toBe('# 자궁근종, 이런 증상이 있습니다\n\n본문입니다.');
  });

  it('joins the answer when it arrives split across several text blocks', () => {
    const result = extractArticleText([
      text('검색하겠습니다.'),
      searchUse(),
      searchResult(),
      text('# 제목\n\n앞부분'),
      text('과 뒷부분입니다.'),
    ]);

    expect(result).toBe('# 제목\n\n앞부분과 뒷부분입니다.');
  });

  it('keeps body written before a follow-up search instead of truncating it', () => {
    // A position-based cut (everything after the last search result) would
    // lose the intro here; anchoring on the title keeps the whole article.
    const result = extractArticleText([
      text('먼저 검색합니다.'),
      searchUse(),
      searchResult(),
      text('# 제목\n\n## 첫 번째 섹션\n내용입니다.\n\n'),
      searchUse(),
      searchResult(),
      text('## 두 번째 섹션\n추가 내용입니다.'),
    ]);

    expect(result).toContain('## 첫 번째 섹션');
    expect(result).toContain('## 두 번째 섹션');
    expect(result.startsWith('# 제목')).toBe(true);
  });

  it('returns text unchanged when it already starts with the title', () => {
    const result = extractArticleText([text('# 제목\n\n본문')]);
    expect(result).toBe('# 제목\n\n본문');
  });

  it('returns everything when no title is present rather than dropping content', () => {
    const result = extractArticleText([text('제목 없는 본문입니다.')]);
    expect(result).toBe('제목 없는 본문입니다.');
  });

  it('ignores non-text blocks entirely', () => {
    const result = extractArticleText([searchUse(), searchResult()]);
    expect(result).toBe('');
  });
});
