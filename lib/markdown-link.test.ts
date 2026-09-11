import { describe, expect, it } from 'vitest';
import { markdownLink, escapeLinkText, escapeLinkDestination } from './markdown-link';

describe('escapeLinkText', () => {
  it('escapes the brackets that would end the link text early', () => {
    // The title that surfaced this: its own brackets closed the link.
    const title = '[고객참여 > ADHD 관리하면 완치된다] <하> 부모의 역할 | 국립정신건강센터';
    const escaped = escapeLinkText(title);

    expect(escaped).toBe(
      '\\[고객참여 > ADHD 관리하면 완치된다\\] <하> 부모의 역할 | 국립정신건강센터'
    );
    // No bracket is left able to terminate the link text.
    expect(escaped.match(/(?<!\\)[[\]]/)).toBeNull();
  });

  it('escapes backslashes before brackets, not after', () => {
    // Escaping in the other order would turn \[ into \\[ — an escaped
    // backslash followed by a live bracket.
    expect(escapeLinkText('a\\b[c]')).toBe('a\\\\b\\[c\\]');
  });

  it('flattens newlines, which would break out of the list item', () => {
    expect(escapeLinkText('첫 줄\n둘째 줄')).toBe('첫 줄 둘째 줄');
    expect(escapeLinkText('첫 줄\r\n  둘째 줄')).toBe('첫 줄 둘째 줄');
  });

  it('leaves ordinary titles untouched', () => {
    expect(escapeLinkText('ADHD 진단과 치료 | 질병관리청')).toBe('ADHD 진단과 치료 | 질병관리청');
  });
});

describe('escapeLinkDestination', () => {
  it('wraps the URL so parentheses cannot close the destination', () => {
    expect(escapeLinkDestination('https://ko.wikipedia.org/wiki/ADHD_(질환)')).toBe(
      '<https://ko.wikipedia.org/wiki/ADHD_(질환)>'
    );
  });

  it('carries a long query string intact', () => {
    const url =
      'https://ncmh.go.kr/ncmh/board/boardView.do;jsessionid=nM1Rp?bn=newsView&fno=39&no=6094';
    expect(escapeLinkDestination(url)).toBe(`<${url}>`);
  });

  it('percent-encodes the only characters the angle form cannot hold', () => {
    expect(escapeLinkDestination('https://example.com/a<b>c')).toBe(
      '<https://example.com/a%3Cb%3Ec>'
    );
  });
});

describe('markdownLink', () => {
  it('produces one link for a title full of syntax characters', () => {
    const link = markdownLink(
      '[고객참여 > ADHD 관리하면 완치된다] <하> 부모의 역할 | 국립정신건강센터',
      'https://ncmh.go.kr/ncmh/board/boardView.do?no=6094'
    );

    expect(link).toBe(
      '[\\[고객참여 > ADHD 관리하면 완치된다\\] <하> 부모의 역할 | 국립정신건강센터](<https://ncmh.go.kr/ncmh/board/boardView.do?no=6094>)'
    );
  });

  it('opens and closes exactly once', () => {
    const link = markdownLink('a]b[c', 'https://example.com');
    const unescapedBrackets = link.slice(1, link.lastIndexOf('](')).match(/(?<!\\)[[\]]/g);
    expect(unescapedBrackets).toBeNull();
  });
});
