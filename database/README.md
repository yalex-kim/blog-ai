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

## An existing database that is behind the code

Run `001_repair_schema.sql`. It `ALTER`s every table into the current shape and
is safe to re-run.

You need it because `schema.sql` is written with `CREATE TABLE IF NOT EXISTS`.
That is right for a fresh project and does nothing for an existing one: once a
table exists the whole `CREATE` is skipped, so a column added to `schema.sql`
after you first ran it never reaches your database. **Re-running `schema.sql`
does not repair drift.**

The drift is not cosmetic. The admin login route filters on `admins.is_active`
before it checks anything else, so against a table missing that column
PostgREST fails the query, the route reads that as "no such admin", and a
correct password comes back as `401` — identical to a wrong one.

`GET /api/health` reports exactly which columns are missing, without needing a
login. Set `HEALTH_CHECK_TOKEN` to require `?token=…` on it.

## Migrations

Run in order, after `schema.sql`:

| File | What it does |
|---|---|
| `001_repair_schema.sql` | Brings an existing database up to the schema the code expects. Fixes the missing-`admins.is_active` 401. |
| `002_byok_and_usage.sql` | Per-tenant encrypted API key columns, and the `usage_events` table behind the usage dashboard. |

Keep `schema.sql` as the current full picture and add `003_*.sql` beside these.

## First admin account

No admin is seeded. Two ways to create one:

**No local setup** — edit the two placeholders in `create-admin.sql` and run it
in the SQL Editor. Postgres hashes the password itself via pgcrypto.

**With a checkout** — `node scripts/generate-admin-hash.js <username> <password>`
and run the `INSERT` it prints.

Both produce a bcrypt hash the login route accepts. See `ADMIN_SETUP.md`.
