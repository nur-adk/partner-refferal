# Klimt & Design — Lead Sourcing

Internal tool for finding fractional CMOs / senior fractional marketing
leaders as partner referral prospects. Built with Next.js, React, Tailwind,
and a local SQLite database via Prisma.

## Status

Built so far:

1. **CSV Upload** (`/upload`) — upload a CSV of manually-sourced leads.
2. **Lead List View** (`/leads`) — sortable/filterable table with a detail
   view per lead.
3. **Editable summary** — each lead's paragraph summary has an **Edit** button
   on its detail page; edits save immediately.
4. **Apollo sourcing** (on `/leads`):
   - **Generate** — searches Apollo for fractional CMOs / senior marketing
     leaders in the selected region (US only for now; CA/UK are shown but
     disabled), then enriches the first _N_ results into full lead records.
   - **Similar To** — paste a LinkedIn profile URL; enriches that seed to learn
     its title/seniority/region, then finds and enriches matching people.
   - **3 More Similar** — pulls the next page of matches for the same seed
     without re-enriching it.
5. **Filtering & review** (on `/leads`):
   - **Industry filter** — leads carry an `industry` tag (curated picklist in
     `lib/constants.ts`, e.g. "Luxury Hospitality"); the table filters by it.
     New leads are auto-tagged best-effort from their title/summary text
     (`guessIndustry`); anything can be set/corrected inline on the detail page.
   - **Company enrichment (free of people-match credits)** — Apollo's *org*
     endpoints (`/organizations/search` → `/organizations/enrich`) resolve a
     lead's company (by website domain, or by name) and return the company's
     industry, size, location, and description. This auto-fills `industry`
     (mapped onto our picklist via `mapApolloIndustry`) and appends a company
     blurb to the summary. Runs automatically on Generate, per-lead via
     **Find from company** on the Industry field, and in bulk via **Enrich from
     company** on `/leads`. Caveat: for solo fractional operators the resolved
     industry is their own consultancy ("Marketing & Advertising" /
     "Management Consulting"), not the client verticals they serve.
   - **Multi-select Role** — the Generate Role control is a checkbox popover, so
     a search can union several decision-maker buckets (e.g. CMO + VP Marketing).
   - **Role filter** — free-text titles are bucketed into decision-maker
     categories (Fractional CMO, CMO, VP Marketing, Head of Marketing, Marketing
     Director, Growth, Brand, Creative Strategy, Product Marketing, Revenue) via
     `TITLE_CATEGORIES` / `categorizeTitle`. The same list feeds Apollo's
     `person_titles`, so **Generate** now sources the full set of senior
     marketing decision-makers, not just fractional CMOs.
   - **Per-lead review controls** — 👍 / 👎 rating, ⭐ favorite, and 🗑️ delete
     (with a confirm) on every row. Favorited leads also surface in a **Favorites**
     panel at the top of the page and a "★ Favorites" filter toggle. Actions are
     server actions in `app/leads/actions.ts`.
6. **Warm Connection Finder** — every lead record automatically flags overlaps
   with the outreach team (Hugh, Ayema, Sadie, Michelle): shared university or
   overlapping employer, with the decision-maker's tenure surfaced (e.g. "Both
   worked at Credit Suisse (Hugh: 2014–2020)"). The leads table shows a 🔗 badge
   on any lead with a connection. Matching is fuzzy (case/punctuation-insensitive,
   handles "University of Chicago" vs "University of Chicago Booth School of
   Business") and runs in-memory — no API cost. Logic lives in
   `lib/warmConnections.ts`.

Decision-maker profiles are stored in the `DecisionMaker` table and seeded from
`prisma/seed.ts` (education + employer history only — the signals the match
needs). Re-run `npx prisma db seed` after editing that file. There is no
in-app editor for these profiles yet; edit the seed or the DB directly.

### Apollo API & credits

The provided key is a **free/trial tier**. This drives a two-call design:

- **Search** (`mixed_people/api_search`) is free but returns only obfuscated
  teasers (first name, title, company name, `has_email` flags) — no full name,
  LinkedIn URL, or email.
- **Enrichment** (`people/match`) returns the full record (name, LinkedIn,
  verified email, location, employment history) but **costs ~1 Apollo credit
  per person**.

So every lead added by **Generate** / **Similar To** spends roughly one credit.
The "How many" field and the fixed 3-per-batch "Similar" size keep that bounded;
`MAX_ENRICH` in `app/leads/actions.ts` is the hard cap. Apollo's `people/match`
does not return education (verified against the live API — no education field,
and `degree`/`major`/`grade_level` on employment history come back null), so
`university` comes in blank from Apollo.

### Free education enrichment (LinkedIn JSON-LD)

Education is filled from each lead's **LinkedIn public profile**, which embeds a
schema.org `Person` JSON-LD blob with an `alumniOf` array of schools. `lib/education.ts`
fetches the profile (keyed on the `linkedinUrl` we already store) and reads the
school names — free, no API key, no search engine (so no rate-limit from a SERP
provider). It runs:

- automatically (best-effort) when **Generate** creates a new lead,
- per-lead via the **Find on LinkedIn** link on the University field, and
- in bulk via the **Fill missing education** button on `/leads`.

It's deliberately best-effort: LinkedIn masks or omits this data for a share of
logged-out requests and throttles bursts, so some leads come back empty and can
be retried later or filled via the inline **Add/Edit** control. Saving a
university immediately recomputes that lead's warm connections (a shared
university is often the strongest overlap with the outreach team). Wikidata and
ORCID were evaluated and rejected — they only cover encyclopedia-notable people
and academic researchers respectively, not marketing execs.

Set `APOLLO_API_KEY` in `.env` (already present in this checkout). Restart
`next dev` after changing `.env` — env vars are read only at server start.

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

The SQLite connection string lives in `.env` (`DATABASE_URL="file:./dev.db"`)
and is already set up. Create the database and apply migrations:

```bash
npx prisma migrate dev
```

This creates `dev.db` in the project root (gitignored — it's your local
data only).

### 3. Seed starter data

Seeds the four outreach team decision-maker profiles (Hugh, Ayema, Sadie,
Michelle) as empty stubs ready to be filled in later:

```bash
npx prisma db seed
```

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Upload leads:** go to `/upload`, download the sample CSV template link
  on that page (or use your own CSV with columns `name, title,
  linkedin_url, email, personal_website, company_website, summary,
  university, past_employers, source`), and upload it. Only `name` is
  required per row.
- **Browse leads:** go to `/leads` to see the sortable/filterable table.
  Click **View** on any row to open the full record, including the
  paragraph summary.

All uploaded leads are tagged `country: "US"` for now. The schema already
supports other country values (e.g. `"CA"`, `"UK"`) so a country filter can
be added later without a schema change.

### Inspecting the database directly

```bash
npx prisma studio
```

Opens a local GUI at [http://localhost:5555](http://localhost:5555) to
browse/edit the `Lead` and `DecisionMaker` tables directly.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- [Prisma](https://www.prisma.io) ORM + SQLite (via `@prisma/adapter-better-sqlite3`)
- [PapaParse](https://www.papaparse.com) for CSV parsing

## Deploying later

The app is a standard Next.js project and can be deployed to Vercel.
**Note:** SQLite files don't persist on Vercel's serverless filesystem, so
before deploying you'll want to swap the Prisma datasource/adapter for a
hosted database (e.g. Postgres via Vercel Postgres/Neon, or Turso for
SQLite-compatible hosting) — the Prisma schema and app code won't need to
change beyond the datasource configuration.
