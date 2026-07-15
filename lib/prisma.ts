import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// libSQL is SQLite-compatible and works both as a local file (dev) and against a
// hosted Turso database (production/Vercel), so the same adapter serves both.
//
// - Local dev: no Turso env vars set → falls back to the local ./dev.db file,
//   exactly like before.
// - Vercel: set TURSO_DATABASE_URL (libsql://…) and TURSO_AUTH_TOKEN in the
//   project's Environment Variables → it uses the hosted database.
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
