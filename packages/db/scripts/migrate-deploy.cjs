/**
 * Normalize DB URL for Vercel/Neon before `prisma migrate deploy`.
 * Fixes common P1013 failures: missing DATABASE_URL, quoted values,
 * and Neon integration vars (POSTGRES_URL / POSTGRES_PRISMA_URL).
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
    if (!url) continue;
    if (/^(postgresql|postgres):\/\//i.test(url)) return url;
  }
  return "";
}

const url = pickDatabaseUrl();
if (!url) {
  console.error(`
[db:migrate:deploy] Invalid or missing database URL (Prisma P1013).

Set one of these in Vercel → Project → Settings → Environment Variables
(for Production and Preview):

  DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

Neon on Vercel often exposes POSTGRES_URL / POSTGRES_PRISMA_URL instead —
those are also accepted by this script.

Do NOT wrap the value in quotes in the Vercel UI.
Do NOT paste the "DATABASE_URL=" prefix into the value field.
Special characters in the password must be URL-encoded (e.g. @ → %40).
`);
  process.exit(1);
}

process.env.DATABASE_URL = url;

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
