# Database

`schema.sql` is the whole schema. Run it once in the Supabase SQL Editor
against a fresh project, then create the `blog-images` storage bucket
(public) as the file's last section describes.

There are no incremental migrations yet — this project starts from one
schema. When the first change lands, add a numbered file here
(`001_*.sql`) and keep `schema.sql` as the current full picture.

To create the first admin account:

```bash
node scripts/generate-admin-hash.js <username> <password>
```

and run the `INSERT` it prints. See `ADMIN_SETUP.md`.
