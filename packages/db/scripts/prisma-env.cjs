/**
 * Normalize DATABASE_URL for Vercel/Neon, then run Prisma CLI.
 * Strips accidental quotes and accepts common Neon/Vercel aliases.
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

function pickDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
  ];
  for (const raw of candidates) {
    const url = stripQuotes(raw);
    if (url && isPgUrl(url)) return url;
  }
  return "";
}

const databaseUrl = pickDatabaseUrl();
if (!databaseUrl) {
  console.error(`
[prisma] Missing or invalid DATABASE_URL (Prisma P1013).

In Vercel → Settings → Environment Variables, set for Production AND Preview:

  DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

Rules:
  - Value only (no DATABASE_URL= prefix)
  - No surrounding quotes
  - Must start with postgresql:// or postgres://
`);
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;

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
