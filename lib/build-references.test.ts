import { describe, expect, it } from 'vitest';
import { buildVerifiedReferences } from './build-references';
import { CitedSnippet } from './extract-citations';

function cited(entries: CitedSnippet[]): Map<string, CitedSnippet> {
  return new Map(entries.map((e) => [e.url, e]));
}

describe('buildVerifiedReferences', () => {
  it('returns nothing when the model listed sources but none were actually cited', () => {
    const parsed = [{ title: '약학정보원', url: 'https://health.kr/example' }];
    expect(buildVerifiedReferences(parsed, cited([]))).toEqual([]);
  });

  it('keeps a cited source even when the model omitted it from its list', () => {
    const result = buildVerifiedReferences(
      [],
      cited([{ url: 'https://health.kr/a', title: 'Health.kr', snippets: ['인용'] }])
    );
    expect(result).toEqual([
      { title: 'Health.kr', url: 'https://health.kr/a', snippets: ['인용'] },
    ]);
  });

  it("prefers the model's Korean title over the raw search-result title", () => {
    const result = buildVerifiedReferences(
      [{ title: '약학정보원 - 타이레놀', url: 'https://health.kr/a' }],
      cited([{ url: 'https://health.kr/a', title: 'health.kr', snippets: ['인용'] }])
    );
    expect(result[0].title).toBe('약학정보원 - 타이레놀');
  });

  it('matches titles across trailing-slash, www and case differences', () => {
    const result = buildVerifiedReferences(
      [{ title: '질병관리청', url: 'https://WWW.Health.kdca.go.kr/info/' }],
      cited([
        { url: 'https://health.kdca.go.kr/info', title: null, snippets: ['인용'] },
      ])
    );
    expect(result[0].title).toBe('질병관리청');
  });

  it('treats differing query strings as different pages', () => {
    const result = buildVerifiedReferences(
      [{ title: '다른 약', url: 'https://health.kr/drug?drug_cd=B22' }],
      cited([
        { url: 'https://health.kr/drug?drug_cd=A11', title: '약학정보원', snippets: ['인용'] },
      ])
    );
    // Falls back to the citation's own title rather than mislabelling it.
    expect(result[0].title).toBe('약학정보원');
  });

  it('falls back to the hostname when no title is available anywhere', () => {
    const result = buildVerifiedReferences(
      [],
      cited([{ url: 'https://www.kogs.or.kr/page', title: null, snippets: ['인용'] }])
    );
    expect(result[0].title).toBe('kogs.or.kr');
  });

  it('carries every snippet through', () => {
    const result = buildVerifiedReferences(
      [],
      cited([{ url: 'https://health.kr/a', title: 'A', snippets: ['첫째', '둘째'] }])
    );
    expect(result[0].snippets).toEqual(['첫째', '둘째']);
  });
});
