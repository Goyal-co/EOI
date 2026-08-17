"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

/**
 * `docker run --env-file` keeps surrounding quotes. Compose strips them.
 * Normalize both so DATABASE_URL / REDIS_URL parse correctly.
 */
for (const key of Object.keys(process.env)) {
  const value = process.env[key];
  if (!value || value.length < 2) continue;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    process.env[key] = value.slice(1, -1);
  }
}

function applySchema() {
  if (process.env.SKIP_DB_PUSH === "1") {
    console.info("[db] SKIP_DB_PUSH=1 — not applying schema");
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error("[db] DATABASE_URL is not set");
    process.exit(1);
  }

  const script = path.join(__dirname, "packages/db/scripts/prisma-env.cjs");
  console.info("[db] applying Prisma schema (db push)...");
  const result = spawnSync(process.execPath, [script, "db", "push", "--skip-generate"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error("[db] failed to start prisma:", result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("[db] prisma db push failed");
    process.exit(result.status ?? 1);
  }
  console.info("[db] schema ready");
}

applySchema();
require("./apps/web/server.js");
