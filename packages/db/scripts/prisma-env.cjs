/**
 * Normalize DATABASE_URL for Vercel/Neon, then run Prisma CLI.
 *
 * `prisma generate` only needs a syntactically valid URL — it does not connect.
 * During Vercel `postinstall`, env vars can be missing briefly; use a placeholder
 * so install can finish. `migrate deploy` still requires a real DATABASE_URL.
 *
 * Neon pooler hosts (`*-pooler.*`) often hang on `migrate deploy` (DDL via PgBouncer).
 * For migrate/db push we prefer an unpooled URL, or strip `-pooler` from the host.
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

function firstPgUrl(candidates) {
  for (const raw of candidates) {
    const url = stripQuotes(raw);
    if (url && isPgUrl(url)) return url;
  }
  return "";
}

function pickDatabaseUrl() {
  return firstPgUrl([
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
  ]);
}

/** Prefer explicit direct/unpooled env vars; else derive from pooler host. */
function toDirectUrl(pooledUrl) {
  const explicit = firstPgUrl([
    process.env.DIRECT_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
  ]);
  if (explicit) return explicit;

  try {
    const u = new URL(pooledUrl);
    if (u.hostname.includes("-pooler.")) {
      u.hostname = u.hostname.replace("-pooler.", ".");
      return u.toString();
    }
  } catch {
    // fall through
  }
  return pooledUrl;
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid-url)";
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/prisma-env.cjs <prisma-args...>");
  process.exit(1);
}

const isGenerate = args[0] === "generate";
const needsDirect =
  args[0] === "migrate"
  || (args[0] === "db" && (args[1] === "push" || args[1] === "pull"));

let databaseUrl = pickDatabaseUrl();

if (!databaseUrl && !isGenerate) {
  console.error(`
[prisma] Missing or invalid DATABASE_URL (Prisma P1013).

In Vercel → Settings → Environment Variables, set for Production AND Preview:

  DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

Rules:
  - Value only (no DATABASE_URL= prefix)
  - No surrounding quotes
  - Must start with postgresql:// or postgres://

Optional (recommended for Neon migrations):
  DIRECT_URL=postgresql://USER:PASSWORD@HOST-without-pooler/DB?sslmode=require
`);
  process.exit(1);
}

if (databaseUrl && needsDirect) {
  const direct = toDirectUrl(databaseUrl);
  if (direct !== databaseUrl) {
    console.info(
      `[prisma] migrate/db using direct host ${safeHost(direct)} (not pooler ${safeHost(databaseUrl)})`,
    );
  } else if (safeHost(databaseUrl).includes("-pooler")) {
    console.warn(
      `[prisma] WARNING: still on pooler host ${safeHost(databaseUrl)} — migrate may hang. Set DIRECT_URL.`,
    );
  }
  databaseUrl = direct;
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
