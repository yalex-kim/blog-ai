# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Production build (Turbopack)
npm run lint     # Run ESLint
npm test         # Run vitest unit tests
```

Vitest covers `lib/verticals/`, `lib/image-prompts.ts`, `lib/session.ts`,
`lib/parse-image-suggestions.ts`, `lib/rate-limit.ts`,
`lib/blog-credential-crypto.ts`, and the reference-verification modules. There
is no end-to-end/integration coverage for API routes or UI flows.

## Architecture

**blog-ai** is a Korean blog SaaS that generates blog posts and matching AI
images for a customer's business, and keeps that writing inside whatever rules
the customer's industry imposes.

### The central idea: vertical packs

The engine — sessions, generation, image storage, reference verification —
knows nothing about any specific industry. Everything industry-specific lives
in one file under `lib/verticals/packs/`, and a tenant's `vertical` column
picks which one applies.

A pack (`lib/verticals/types.ts` defines the contract) supplies:

| Field | What it controls |
|---|---|
| `terminology` | Every label the tenant sees — 병원 이름 vs 센터 이름, 환자 vs 보호자 |
| `writing` | Persona, compliance rules, tone, structure, banned phrases, CTA, research rules |
| `images` | Which slots a post uses, and the visual style of each |
| `imagery` | Domain framing injected into every image prompt |
| `trustedDomains` | Seed allowlist for the `web_search` tool |
| `topicCategories` | The categories the topic recommender proposes |

**Adding an industry is one file plus one line in `registry.ts`. Nothing else
should branch on a vertical id.** If you find yourself writing
`if (vertical === '...')` anywhere outside `lib/verticals/`, the pack contract
is missing a field — add it there instead.

Shipped packs: `generic`, `medical-obgyn` (산부인과, 의료법 광고 규정),
`child-development` (아동·청소년 발달센터 — ADHD·틱·발달지연·언어·사회성·양육코칭).

`getVertical()` falls back to the generic pack for an unknown id rather than
throwing: a tenant losing their industry voice is a much better failure than
their dashboard 500ing.

### Tech Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- Anthropic Claude (`claude-sonnet-4-5-20250929`) for blog text, with the
  server-side `web_search` tool for grounding
- OpenAI DALL·E or Google Gemini for images (switchable via `IMAGE_PROVIDER`)
- Supabase for the database (`tenants`, `admins`, `blog_posts`, `blog_images`)
  and Storage (`blog-images` bucket)

### Two-tier auth system
Sessions are HMAC-SHA256-signed JSON tokens
(`base64url(payload).base64url(signature)`, signed with `SESSION_SECRET`)
stored in HttpOnly cookies — see `lib/session.ts`. Two cookie names with
different `type` fields:
- `session` → tenant users (`/api/auth/*`, `/dashboard`, `/settings`), via `createTenantSessionToken`/`getSession`
- `admin_session` → admins (`/api/admin/*`, `/admin`), via `createAdminSessionToken`/`getAdminSession`

All routes requiring auth must use `getSession`/`getAdminSession` — do not
re-implement cookie parsing locally. State-changing routes (`POST`/`PUT`)
should also call `isTrustedOrigin` from `lib/request-security.ts` as
defense-in-depth against CSRF, and login/generation endpoints should call
`checkRateLimit` from `lib/rate-limit.ts` (in-memory, per-instance).

### Key data flows

**Blog generation** (`/api/generate-blog`):
1. Loads the tenant, resolves its pack via `getVertical`
2. `buildBlogSystemPrompt(pack)` composes the system prompt; `buildBlogUserMessage` composes the per-request message
3. Claude runs with `web_search` restricted to the tenant's (or pack's) trusted domains
4. Claude embeds image suggestions inline: `[#번호 | Type | 묘사 | text : 텍스트]`
5. `parseImageSuggestions` extracts them; `buildVerifiedReferences` keeps only sources that were actually cited and verified
6. Saves to `blog_posts`, returns `{ content, imageKeywords, references, imageSuggestions[], blogPostId }`

**Image generation** (`/api/generate-images`):
1. Loads the tenant's pack and thumbnail branding in one round trip
2. `generateImagePrompt(pack, type, …)` builds the prompt — THUMBNAIL gets its own typographic builder, everything else uses the pack's slot template
3. Routes to the active provider via `lib/image-providers/factory.ts`
4. Uploads to Supabase Storage, saves metadata with `display_order` and `prompt_id`

**Topic recommendation** (`/api/topics/recommend`): `buildTopicPrompt(pack, …)`
asks for the pack's own categories and parses them back by those keys.

### Image slots

Slot names are engine-level and persisted in `blog_images.image_type`, so they
are stable: `THUMBNAIL`, `INTRO`, `EXPLAINER`, `LIFESTYLE`, `WARNING`, `CTA`,
`INFOGRAPHIC`. What each slot *depicts* is the pack's business — `EXPLAINER`
renders anatomy for a clinic and a development-milestone diagram for a therapy
centre. `MEDICAL` is the historical name for `EXPLAINER`; `resolveImageType()`
maps it so older posts still parse.

INTRO and LIFESTYLE carry no `text` overlay (`hasTextOverlay: false`). Parsing
lives in `lib/parse-image-suggestions.ts` — change the format there, not inline.

### Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase's "publishable key" (sb_publishable_…)
SUPABASE_SERVICE_ROLE_KEY=       # Supabase's "secret key" (sb_secret_…) — server only
SESSION_SECRET=                  # signs session cookies (openssl rand -base64 48)
BLOG_CREDENTIAL_ENCRYPTION_KEY=  # encrypts tenants' blog platform passwords at rest
ANTHROPIC_API_KEY=
IMAGE_PROVIDER=openai            # or 'gemini'
OPENAI_API_KEY=
GEMINI_API_KEY=
```

`SESSION_SECRET` and `BLOG_CREDENTIAL_ENCRYPTION_KEY` are required — routes
that need them throw at request time if unset.

### Database setup

Run `database/schema.sql` once in the Supabase SQL Editor, then create the
public `blog-images` storage bucket. The file refuses to run against a
medblog-ai database; `database/migrate-from-medblog.sql` converts one in place
instead. See `database/README.md`.

The app uses `supabaseAdmin` (service role key) for all server-side DB
operations, bypassing RLS. RLS is enabled with no permissive policies as a
safety net in case the anon key is ever pointed at these tables — it is not the
primary access control.

### Admin system

Tenants are created by admins at `/admin`, where the admin also picks the
account's vertical. Admin credentials use bcrypt; there is no seeded admin —
create the first with `node scripts/generate-admin-hash.js <username> <password>`
and run the printed `INSERT`. See `ADMIN_SETUP.md`.

Tenant accounts have a `must_change_password` flag — if set, users are
redirected to `/change-password` after login.
