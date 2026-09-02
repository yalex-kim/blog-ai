# blog-ai

한국어 블로그 글과 이미지를 자동 생성하는 SaaS. **업종 팩(vertical pack)** 하나만
추가하면 새로운 업종을 지원합니다.

## 왜 팩인가

블로그 자동 생성에서 업종마다 실제로 달라지는 것은 정해져 있습니다.

- 지켜야 하는 규제 (의료법 광고 규정 / 표시광고법 / 진단 금지)
- 독자를 부르는 말 (환자 / 보호자 / 고객)
- 이미지 톤 (임상 도해 / 따뜻한 일러스트)
- 근거로 삼을 수 있는 출처
- 주제 카테고리

엔진(세션, 생성, 이미지 저장, 참고자료 검증)은 이 중 무엇도 알지 못합니다.
전부 `lib/verticals/packs/` 안의 파일 하나가 공급합니다.

```
lib/verticals/
├─ types.ts                  업종 팩 계약
├─ registry.ts               id → 팩
├─ image-slot-defaults.ts    이미지 슬롯 기본값
├─ build-blog-prompt.ts      팩 → 시스템 프롬프트
└─ packs/
   ├─ generic.ts             일반 사업자
   ├─ medical-obgyn.ts       산부인과 (의료법)
   └─ child-development.ts   아동·청소년 발달센터
```

## 새 업종 추가하기

1. `lib/verticals/packs/<업종>.ts` 를 만들고 `VerticalPack` 을 채웁니다
   (`generic.ts` 를 복사해서 시작하는 것이 가장 빠릅니다)
2. `registry.ts` 의 `PACKS` 배열에 추가합니다
3. `npm test` — 팩 불변식 테스트가 자동으로 새 팩에도 적용됩니다

그게 전부입니다. 라우트, 대시보드, 설정 화면은 수정할 필요가 없습니다.

> `lib/verticals/` 바깥에서 `if (vertical === '...')` 를 쓰게 된다면, 팩 계약에
> 필드가 빠진 것입니다. 분기 대신 필드를 추가하세요.

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

DB는 `database/schema.sql` 을 Supabase SQL Editor에서 한 번 실행하고,
`blog-images` 퍼블릭 스토리지 버킷을 만들면 됩니다. 관리자 계정 생성은
`ADMIN_SETUP.md` 를 보세요.

## 기술 스택

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase ·
Anthropic Claude (web_search 그라운딩) · OpenAI DALL·E 또는 Google Gemini

자세한 구조는 `CLAUDE.md` 에 있습니다.
