# Database

## A fresh project

`schema.sql` is the whole schema. Run it once in the Supabase SQL Editor,
then create a **public** storage bucket named `blog-images`.

It starts with a preflight check that aborts if the database already holds a
medblog-ai schema, rather than half-applying itself. If you hit that error,
see below.

## Reusing the medblog-ai database

`migrate-from-medblog.sql` converts a medblog-ai database into a blog-ai one
in place: `hospitals` → `tenants`, the two different `hospital_id` columns
into `login_id` and `tenant_id`, plus the new `vertical` column (existing
accounts land on `medical-obgyn`, so their behaviour is unchanged).

**It breaks any medblog-ai deployment still pointed at that database**, the
moment it finishes. Only run it if you are retiring medblog-ai. If both apps
need to keep working, give blog-ai its own Supabase project.

Take a backup first. The script is safe to re-run.

## Migrations

There is no numbered migration chain yet. When the first schema change lands,
add `001_*.sql` here and keep `schema.sql` as the current full picture.

## First admin account

No admin is seeded. Two ways to create one:

**No local setup** — edit the two placeholders in `create-admin.sql` and run it
in the SQL Editor. Postgres hashes the password itself via pgcrypto.

**With a checkout** — `node scripts/generate-admin-hash.js <username> <password>`
and run the `INSERT` it prints.

Both produce a bcrypt hash the login route accepts. See `ADMIN_SETUP.md`.
