-- ============================================================================
-- blog-ai — full schema
-- ============================================================================
-- Run once, in the Supabase SQL Editor, against a fresh project.
--
-- The app talks to these tables with the service role key, which bypasses RLS.
-- RLS is enabled everywhere with no permissive policies as a safety net: if the
-- anon key is ever pointed at these tables, it sees nothing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Preflight: refuse to run against a medblog-ai database
-- ---------------------------------------------------------------------------
-- Every CREATE below says IF NOT EXISTS, which is right for re-running this
-- file against its own schema and badly wrong against the older medblog-ai
-- one: the tables would be skipped as "already there" while the indexes and
-- columns underneath them fail one at a time, leaving a half-applied mess.
-- Fail loudly on the first statement instead.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hospitals'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'hospital_id'
  ) THEN
    RAISE EXCEPTION
      'This database already holds a medblog-ai schema. Use a separate Supabase project for blog-ai, or run database/migrate-from-medblog.sql to convert this one in place (which will break any medblog-ai deployment still pointed at it).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- tenants — one row per customer account
-- ---------------------------------------------------------------------------
-- `vertical` names the industry pack under lib/verticals/packs. It decides the
-- writing rules, image styling, trusted sources, and every label the tenant
-- sees. An unknown value degrades to the generic pack rather than erroring, so
-- removing a pack from the code never breaks an existing account.
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- credentials
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,

  -- industry
  vertical TEXT NOT NULL DEFAULT 'generic',
  category TEXT,

  -- profile, filled in by the tenant during setup
  name TEXT,
  main_services TEXT[] DEFAULT '{}',
  address TEXT,

  -- per-tenant override of the pack's web_search allowlist; empty means
  -- "use the pack's list"
  trusted_domains TEXT[] DEFAULT '{}',

  -- destination blog account
  blog_platform TEXT DEFAULT 'naver',
  blog_id TEXT,
  blog_password_encrypted TEXT,
  blog_board_name TEXT,

  is_initial_setup_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN tenants.vertical IS 'Industry pack id — see lib/verticals/registry.ts';
COMMENT ON COLUMN tenants.trusted_domains IS 'Domain allowlist passed to the web_search tool; empty falls back to the pack';
COMMENT ON COLUMN tenants.blog_password_encrypted IS 'Encrypted with BLOG_CREDENTIAL_ENCRYPTION_KEY — never stored in plaintext';

-- ---------------------------------------------------------------------------
-- admins — staff who create and manage tenant accounts
-- ---------------------------------------------------------------------------
-- Deliberately a separate table from tenants: an admin session and a tenant
-- session are different cookies with different privileges, and keeping the
-- rows apart makes it impossible to escalate one into the other by accident.
-- No account is seeded; create the first with scripts/generate-admin-hash.js.
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- blog_posts — generated articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  topic TEXT,
  keywords TEXT[] DEFAULT '{}',
  image_keywords TEXT[] DEFAULT '{}',
  -- Only sources the model actually cited and that were verified against the
  -- search results survive into this column — see lib/build-references.ts.
  reference_links JSONB DEFAULT '[]'::jsonb,
  posted_to_blog BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant ON blog_posts(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- blog_images — generated images, one row per suggestion slot
-- ---------------------------------------------------------------------------
-- `image_type` holds the engine-level slot name (THUMBNAIL, INTRO, EXPLAINER,
-- LIFESTYLE, WARNING, CTA, INFOGRAPHIC). These names are stable across packs;
-- what each slot depicts is the pack's business. Rows written before the
-- EXPLAINER rename may still say MEDICAL — resolveImageType() maps it.
CREATE TABLE IF NOT EXISTS blog_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  text_content TEXT,
  image_type TEXT,
  -- Ties an image back to the `[#n | …]` suggestion it was generated from, so
  -- regenerating one image replaces the right row.
  prompt_id TEXT,
  display_order INTEGER,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_images_post_id ON blog_images(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_images_order ON blog_images(blog_post_id, display_order);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_images ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated on purpose. Every read and write goes
-- through the server with the service role key, which is not subject to RLS.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Create a PUBLIC bucket named `blog-images` in Supabase Dashboard → Storage.
-- Public read is intended: generated images are embedded in blog posts that
-- are themselves published. Uploads only ever happen server-side.
