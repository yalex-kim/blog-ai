import { describe, expect, it } from 'vitest';
import { parseReferences } from './parse-references';

describe('parseReferences', () => {
  it('returns no references and unchanged content when there is no section', () => {
    const content = '# 제목\n\n본문 내용입니다.';
    const result = parseReferences(content);
    expect(result.references).toEqual([]);
    expect(result.content).toBe(content);
  });

  it('extracts references and strips the section from the content', () => {
    const content = [
      '# 제목',
      '',
      '본문 내용입니다.',
      '',
      '[참고자료]',
      '- 약학정보원: https://health.kr/searchDrug/result_drug.asp?drug_cd=A11A0720A0625',
      '- 질병관리청 국가건강정보포털: https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/main.do',
    ].join('\n');

    const result = parseReferences(content);

    expect(result.references).toEqual([
      { title: '약학정보원', url: 'https://health.kr/searchDrug/result_drug.asp?drug_cd=A11A0720A0625' },
      { title: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/main.do' },
    ]);
    expect(result.content).toBe('# 제목\n\n본문 내용입니다.');
  });

  it('ignores malformed lines inside the section', () => {
    const content = [
      '본문',
      '',
      '[참고자료]',
      '- 형식이 잘못된 줄',
      '- 정상 출처: https://amc.seoul.kr/asan/healthinfo/disease/diseaseDetail.do',
    ].join('\n');

    const result = parseReferences(content);

    expect(result.references).toEqual([
      { title: '정상 출처', url: 'https://amc.seoul.kr/asan/healthinfo/disease/diseaseDetail.do' },
    ]);
  });

  it('returns an empty list when the section is present but empty', () => {
    const content = '본문\n\n[참고자료]';
    const result = parseReferences(content);
    expect(result.references).toEqual([]);
    expect(result.content).toBe('본문');
  });
});
