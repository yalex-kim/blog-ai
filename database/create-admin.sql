-- ============================================================================
-- Create the first admin account, without a local Node install
-- ============================================================================
--
-- scripts/generate-admin-hash.js does the same thing, but needs Node and a
-- checkout. Postgres can hash the password itself: pgcrypto's gen_salt('bf')
-- produces a bcrypt hash, and bcryptjs — which the login route uses — verifies
-- it. (pgcrypto writes the $2a$ prefix and bcryptjs writes $2b$; for passwords
-- under 72 bytes the two are byte-identical, and bcryptjs accepts both.)
--
-- Replace BOTH placeholders below, then run the whole file in the Supabase
-- SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO admins (username, password_hash, role, full_name)
VALUES (
  'admin',                                  -- <- login username
  crypt('CHANGE_ME', gen_salt('bf', 10)),   -- <- password, hashed on the server
  'super_admin',
  'System Administrator'
);

-- Confirm it took. `password_ok` must come back true; if it is false, the
-- password you typed here and the one you will type at /admin/login differ.
SELECT
  username,
  role,
  password_hash = crypt('CHANGE_ME', password_hash) AS password_ok
FROM admins
WHERE username = 'admin';

-- ---------------------------------------------------------------------------
-- Changing an admin password later (there is no UI for it yet):
--
--   UPDATE admins
--   SET password_hash = crypt('NEW_PASSWORD', gen_salt('bf', 10)),
--       updated_at = NOW()
--   WHERE username = 'admin';
--
-- ---------------------------------------------------------------------------
-- If `gen_salt` or `crypt` comes back "function does not exist", pgcrypto
-- landed outside the search path — qualify the calls:
--
--   extensions.crypt('CHANGE_ME', extensions.gen_salt('bf', 10))
--
-- ---------------------------------------------------------------------------
-- The plaintext password is in this query, so it also lands in the SQL
-- Editor's recent-query history. Clear it there when you are done, or use a
-- throwaway password now and change it with the UPDATE above.
-- ============================================================================
