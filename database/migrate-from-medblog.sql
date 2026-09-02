-- ============================================================================
-- Convert a medblog-ai database into a blog-ai one, in place
-- ============================================================================
--
-- ⚠ READ THIS FIRST
--
-- This renames tables and columns that a running medblog-ai deployment still
-- queries. The moment it finishes, that deployment starts failing — it will
-- ask for `hospitals` and `hospital_id`, which no longer exist.
--
-- Only run this if you are retiring medblog-ai and moving its data to blog-ai.
-- If both apps need to keep working, give blog-ai its own Supabase project and
-- run schema.sql there instead.
--
-- Take a backup first (Supabase Dashboard → Database → Backups).
--
-- Safe to re-run: every step checks whether it has already been applied.
-- ============================================================================

BEGIN;

-- --- tenants ---------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'hospitals') THEN
    ALTER TABLE hospitals RENAME TO tenants;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'hospital_id') THEN
    ALTER TABLE tenants RENAME COLUMN hospital_id TO login_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'hospital_name') THEN
    ALTER TABLE tenants RENAME COLUMN hospital_name TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'department') THEN
    ALTER TABLE tenants RENAME COLUMN department TO category;
  END IF;
END $$;

-- Every existing account is a clinic, so they all start on the pack that
-- reproduces their current behaviour. New accounts pick their own.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vertical TEXT NOT NULL DEFAULT 'medical-obgyn';

-- The column default only applies to future rows; make the existing ones
-- explicit too, in case any predate the ADD COLUMN.
UPDATE tenants SET vertical = 'medical-obgyn' WHERE vertical IS NULL OR vertical = '';

-- Then drop the migration-only default: a brand-new account should be told
-- its vertical by the admin, not silently inherit 산부인과.
ALTER TABLE tenants ALTER COLUMN vertical SET DEFAULT 'generic';

COMMENT ON COLUMN tenants.vertical IS 'Industry pack id — see lib/verticals/registry.ts';

-- --- blog_posts ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'hospital_id') THEN
    ALTER TABLE blog_posts RENAME COLUMN hospital_id TO tenant_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant ON blog_posts(tenant_id, created_at DESC);

-- --- blog_images -----------------------------------------------------------
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS image_type TEXT;
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS prompt_id TEXT;
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS display_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_blog_images_post_id ON blog_images(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_images_order ON blog_images(blog_post_id, display_order);

-- MEDICAL was renamed to EXPLAINER when the slot names stopped being
-- industry-specific. resolveImageType() maps the old name at read time, so
-- this backfill is housekeeping rather than a correctness fix.
UPDATE blog_images SET image_type = 'EXPLAINER' WHERE image_type = 'MEDICAL';

-- --- admins ----------------------------------------------------------------
ALTER TABLE admins ADD COLUMN IF NOT EXISTS full_name TEXT;

-- --- RLS -------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_images ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- After this runs, verify:
--   SELECT login_id, name, vertical, category FROM tenants;
-- Existing posts keep working; their `[#n | MEDICAL | ...]` markers still
-- parse via the alias.
-- ============================================================================
