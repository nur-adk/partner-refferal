# Deploying to Vercel

The app runs on SQLite locally (the `dev.db` file) and on a hosted, SQLite-
compatible **Turso** database in production — same code, same schema, switched by
environment variables. Local development needs **no** changes and keeps using
`dev.db`.

## One-time setup

### 1. Create a free Turso database
Install the CLI and sign up (free tier is plenty for this app):

```bash
brew install tursodatabase/tap/turso   # or: curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create partner-referral
```

Grab the two values the app needs:

```bash
turso db show partner-referral --url          # -> TURSO_DATABASE_URL (libsql://…)
turso db tokens create partner-referral       # -> TURSO_AUTH_TOKEN
```

### 2. Copy your local data up to Turso
From the project root (this recreates the tables and copies every row):

```bash
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:push-turso
```

You should see `✓ Lead: N rows copied`. Re-running it overwrites Turso with a
fresh copy of your local data, so it doubles as a "resync" command.

### 3. Push the code to GitHub and import into Vercel
```bash
git add -A && git commit -m "Vercel-ready: Turso database"
git push   # to a GitHub repo
```
Then in Vercel: **Add New → Project → import the repo.** Framework auto-detects
as Next.js; no build settings to change (the build script already runs
`prisma generate`).

### 4. Set Environment Variables in Vercel
Project → **Settings → Environment Variables** (Production + Preview):

| Name | Value |
|------|-------|
| `APOLLO_API_KEY` | your Apollo key |
| `TURSO_DATABASE_URL` | `libsql://…` from step 1 |
| `TURSO_AUTH_TOKEN` | token from step 1 |

Deploy. That's it.

## How it works (why local is unaffected)
`lib/prisma.ts` uses the libSQL adapter. With no `TURSO_*` vars set it falls back
to `file:./dev.db`, so local dev is identical to before. On Vercel the vars are
set, so it talks to Turso over the network — which is what makes writes (adding
leads, favorites, enrichment) actually persist on Vercel's read-only filesystem.

## Notes
- The Prisma migration files are historical and not used for the Turso setup —
  `npm run db:push-turso` builds the schema directly from your current local DB,
  which is the source of truth.
- To wipe and re-seed decision-makers on Turso instead of copying, you can run
  `tsx prisma/seed.ts` with the `TURSO_*` vars set — but the copy script already
  brings them over.
