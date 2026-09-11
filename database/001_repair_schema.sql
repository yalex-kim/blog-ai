-- ============================================================================
-- 001 — bring an existing blog-ai database up to the current schema
-- ============================================================================
-- Run this in the Supabase SQL Editor against a database that already has the
-- blog-ai tables. Safe to re-run, and safe to run on a database that is
-- already current (every statement is a no-op then).
--
-- WHY THIS FILE EXISTS
--
-- schema.sql creates every table with CREATE TABLE IF NOT EXISTS. That is the
-- right thing for a fresh project and does nothing useful for an existing one:
-- once `admins` exists, the whole CREATE is skipped, so a column added to
-- schema.sql *after* you first ran it never reaches your database. Re-running
-- schema.sql does not repair drift — only ALTER TABLE does.
--
-- The drift this fixes is not cosmetic. The admin login route filters on
-- `is_active` before it checks anything else:
--
--     .eq('username', username).eq('is_active', true).single()
--
-- Against a table without that column PostgREST returns error 42703, the route
-- treats any error as "no such admin", and a perfectly correct username and
-- password come back as 401 — indistinguishable from a wrong password. The
-- same shape of failure hits tenant login through any column the row mapper
-- touches.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Preflight: this file repairs a blog-ai database, not a medblog-ai one
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'hospitals')
     OR EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'blog_posts'
                  AND column_name = 'hospital_id') THEN
    RAISE EXCEPTION
      'This database still holds medblog-ai names (hospitals / hospital_id). Run database/migrate-from-medblog.sql first — it renames them — then run this file.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    RAISE EXCEPTION
      'No `tenants` table here. This is a fresh database — run database/schema.sql instead of this file.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- admins
-- ---------------------------------------------------------------------------
-- is_active is the one that breaks login outright; the other two are read and
-- written on the same code path, one step later.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS full_name     TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role          TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- An admin row that predates the column could have been left NULL by a hand
-- written INSERT; NULL is not TRUE, so it would still fail the login filter.
UPDATE admins SET is_active = TRUE WHERE is_active IS NULL;

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vertical                  TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS category                  TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name                      TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS main_services             TEXT[] DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address                   TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trusted_domains           TEXT[] DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blog_platform             TEXT DEFAULT 'naver';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blog_id                   TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blog_password_encrypted   TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blog_board_name           TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS must_change_password      BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_initial_setup_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE tenants SET vertical = 'generic' WHERE vertical IS NULL OR vertical = '';

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS title           TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS topic           TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS keywords        TEXT[] DEFAULT '{}';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS image_keywords  TEXT[] DEFAULT '{}';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS reference_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS posted_to_blog  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant ON blog_posts(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- blog_images
-- ---------------------------------------------------------------------------
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS text_content  TEXT;
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS image_type    TEXT;
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS prompt_id     TEXT;
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS prompt        TEXT;
ALTER TABLE blog_images ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_blog_images_post_id ON blog_images(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_images_order   ON blog_images(blog_post_id, display_order);

-- ---------------------------------------------------------------------------
-- RLS — enabled with no permissive policies, as a backstop behind the service
-- role key the server actually uses.
-- ---------------------------------------------------------------------------
ALTER TABLE tenants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_images ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- Verify. Every row must come back with ok = true.
-- ============================================================================
SELECT
  c.expected_table || '.' || c.expected_column AS column,
  EXISTS (
    SELECT 1 FROM information_schema.columns ic
    WHERE ic.table_schema = 'public'
      AND ic.table_name = c.expected_table
      AND ic.column_name = c.expected_column
  ) AS ok
FROM (VALUES
  ('admins', 'username'), ('admins', 'password_hash'), ('admins', 'role'),
  ('admins', 'full_name'), ('admins', 'is_active'), ('admins', 'last_login_at'),
  ('tenants', 'login_id'), ('tenants', 'password_hash'), ('tenants', 'vertical'),
  ('tenants', 'must_change_password'), ('tenants', 'is_initial_setup_complete'),
  ('tenants', 'trusted_domains'), ('tenants', 'blog_password_encrypted'),
  ('blog_posts', 'tenant_id'), ('blog_posts', 'reference_links'),
  ('blog_images', 'blog_post_id'), ('blog_images', 'image_type'),
  ('blog_images', 'display_order')
) AS c(expected_table, expected_column)
ORDER BY 1;

-- And confirm there is an admin that can actually log in. `is_active` must be
-- true, or the login filter drops the row before the password is ever checked.
SELECT username, role, is_active, last_login_at FROM admins ORDER BY created_at;
