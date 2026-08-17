"use strict";

/**
 * First-boot only:
 *   1. prisma db push if public."User" is missing
 *   2. create superadmin if that email is missing
 * Later container restarts skip both. Password is never overwritten.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const name = (process.env.ADMIN_NAME || "Super Admin").trim() || "Super Admin";

async function tableExists(prisma, name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    name,
  );
  return Boolean(rows[0]?.present);
}

async function schemaReady(prisma) {
  const user = await tableExists(prisma, "User");
  const templates = await tableExists(prisma, "EmailTemplate");
  return user && templates;
}

function pushSchema() {
  const script = path.join(__dirname, "packages/db/scripts/prisma-env.cjs");
  console.info("[db] first boot — applying Prisma schema");
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
  console.info("[db] schema created");
}

async function ensureSchema() {
  if (process.env.SKIP_DB_PUSH === "1") {
    console.info("[db] SKIP_DB_PUSH=1 — skipping");
    return;
  }
  const prisma = new PrismaClient();
  try {
    if (await schemaReady(prisma)) {
      console.info("[db] schema already exists — skipping db push");
      return;
    }
  } finally {
    await prisma.$disconnect();
  }
  pushSchema();
}

async function ensureAdmin() {
  if (process.env.SKIP_ADMIN_SEED === "1") {
    console.info("[admin] SKIP_ADMIN_SEED=1 — skipping");
    return;
  }
  if (!email || !password) {
    console.warn("[admin] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping superadmin");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.info("[admin] superadmin already exists — skipping:", email);
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        adminProfile: { create: {} },
      },
    });
    console.info("[admin] superadmin created:", email);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[db] DATABASE_URL is not set");
    process.exit(1);
  }
  await ensureSchema();
  await ensureAdmin();
}

main().catch((error) => {
  console.error("[bootstrap] failed:", error.message || error);
  process.exit(1);
});
