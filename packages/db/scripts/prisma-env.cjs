/**
 * Normalize DATABASE_URL / DIRECT_URL for Vercel + Neon, then run Prisma CLI.
 *
 * schema.prisma requires:
 *   url       = env("DATABASE_URL")
 *   directUrl = env("DIRECT_URL")
 *
 * Empty / quoted / missing DIRECT_URL causes P1013 ("scheme is not recognized").
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

function applyDatabaseEnv() {
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
    databaseUrl,
  ]);

  if (!databaseUrl) {
    console.error(`
[prisma] Invalid or missing DATABASE_URL (Prisma P1013).

Set in Vercel → Settings → Environment Variables (Production + Preview):

  DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
  DIRECT_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

Neon: DATABASE_URL = pooled (-pooler), DIRECT_URL = non-pooled.
If you only have one URL, set BOTH to that same value.

Do not wrap values in quotes in the Vercel UI.
`);
    process.exit(1);
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = directUrl || databaseUrl;
}

applyDatabaseEnv();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/prisma-env.cjs <prisma-args...>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
