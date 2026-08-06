/**
 * Normalize DB URL for Vercel/Neon before `prisma migrate deploy`.
 * Fixes common P1013 failures: missing DATABASE_URL / DIRECT_URL, quoted values,
 * and Neon integration vars (POSTGRES_URL / POSTGRES_PRISMA_URL).
 *
 * schema.prisma requires both:
 *   url       = env("DATABASE_URL")
 *   directUrl = env("DIRECT_URL")
 */
const { spawnSync } = require("node:child_process");

function stripQuotes(value) {
  const v = String(value || "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"'))
    || (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function isPgUrl(url) {
  return /^(postgresql|postgres):\/\//i.test(url);
}

function pickUrl(candidates) {
  for (const raw of candidates) {
    const url = stripQuotes(raw);
    if (url && isPgUrl(url)) return url;
  }
  return "";
}

const databaseUrl = pickUrl([
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
]);

const directUrl = pickUrl([
  process.env.DIRECT_URL,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DATABASE_URL_UNPOOLED,
  // Fall back to the same URL when a separate direct host is not configured.
  databaseUrl,
]);

if (!databaseUrl || !directUrl) {
  console.error(`
[db:migrate:deploy] Invalid or missing database URL (Prisma P1013).

This project requires BOTH env vars (see packages/db/prisma/schema.prisma):

  DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
  DIRECT_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

On Neon:
  DATABASE_URL → pooled host (often contains "-pooler")
  DIRECT_URL   → non-pooled / direct host (no "-pooler")

If you only have one URL, set DIRECT_URL to the same value as DATABASE_URL.

Also accepted aliases: POSTGRES_PRISMA_URL, POSTGRES_URL, POSTGRES_URL_NON_POOLING.

In the Vercel UI:
  - Do NOT wrap values in quotes
  - Do NOT paste the "DATABASE_URL=" prefix into the value field
  - Enable the vars for Production AND Preview
  - URL-encode special characters in the password (e.g. @ → %40)
`);
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = directUrl;

const result = spawnSync(
  "npx",
  ["prisma", "migrate", "deploy"],
  {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
