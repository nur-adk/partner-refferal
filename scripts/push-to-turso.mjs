// One-time (re-runnable) copy of the local SQLite database into a hosted Turso
// database. Recreates each table from the local schema and copies every row, so
// the deployed app starts with exactly the data you have locally.
//
// Usage (from the project root):
//   TURSO_DATABASE_URL="libsql://<your-db>.turso.io" \
//   TURSO_AUTH_TOKEN="<token>" \
//   npm run db:push-turso
//
// Get both values from `turso db show <name> --url` and
// `turso db tokens create <name>` (Turso CLI), or the Turso dashboard.

import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.error("✗ Set TURSO_DATABASE_URL (libsql://…) and TURSO_AUTH_TOKEN, then re-run.");
  process.exit(1);
}

const LOCAL = "./dev.db";
const TABLES = ["DecisionMaker", "Lead"]; // DecisionMaker first (no FK, but tidy)

const local = new Database(LOCAL, { readonly: true });
const remote = createClient({ url, authToken });

for (const table of TABLES) {
  const createSql = local
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table)?.sql;
  if (!createSql) {
    console.warn(`• ${table}: not found locally — skipping`);
    continue;
  }

  const rows = local.prepare(`SELECT * FROM "${table}"`).all();

  // Fresh copy: drop + recreate from the local schema, then bulk insert.
  await remote.execute(`DROP TABLE IF EXISTS "${table}"`);
  await remote.execute(createSql);

  if (rows.length > 0) {
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => "?").join(", ");
    const insert = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
    const batch = rows.map((r) => ({ sql: insert, args: cols.map((c) => r[c]) }));
    await remote.batch(batch, "write");
  }

  console.log(`✓ ${table}: ${rows.length} rows copied`);
}

// Recreate the indexes the schema defines (nice-to-have; queries work without).
const indexes = local
  .prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")
  .all();
for (const { sql } of indexes) {
  try {
    await remote.execute(sql.replace(/^CREATE INDEX/i, "CREATE INDEX IF NOT EXISTS"));
  } catch {
    /* index may already exist / be implicit — non-fatal */
  }
}

local.close();
console.log("\nDone. Turso now mirrors your local database.");
