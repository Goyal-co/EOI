/**
 * Normalize DATABASE_URL for Vercel/Neon, then run Prisma CLI.
 *
 * `prisma generate` only needs a syntactically valid URL — it does not connect.
 * During Vercel `postinstall`, env vars can be missing briefly; use a placeholder
 * so install can finish. `migrate deploy` still requires a real DATABASE_URL.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const PLACEHOLDER_URL =
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

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

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/prisma-env.cjs <prisma-args...>");
  process.exit(1);
}

const isGenerate = args[0] === "generate";
const databaseUrl = pickDatabaseUrl();

if (!databaseUrl && !isGenerate) {
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

process.env.DATABASE_URL = databaseUrl || PLACEHOLDER_URL;
if (!databaseUrl && isGenerate) {
  console.warn("[prisma] DATABASE_URL unset during generate — using placeholder (no DB connection needed)");
}

let prismaEntry;
try {
  prismaEntry = require.resolve("prisma/build/index.js");
} catch {
  prismaEntry = null;
}

console.info(`[prisma] running: prisma ${args.join(" ")}`);

const result = prismaEntry
  ? spawnSync(process.execPath, [prismaEntry, ...args], {
      stdio: "inherit",
      env: process.env,
      cwd: path.join(__dirname, ".."),
    })
  : spawnSync("npx", ["prisma", ...args], {
      stdio: "inherit",
      env: process.env,
      cwd: path.join(__dirname, ".."),
      shell: process.platform === "win32",
    });

if (result.error) {
  console.error("[prisma] failed to start:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
