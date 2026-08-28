"use strict";

/**
 * Container boot:
 *   1. prisma migrate deploy (apply pending migrations) unless SKIP_DB_MIGRATE=1
 *   2. optional fosName → CPTeamMember backfill unless SKIP_TEAM_BACKFILL=1
 *   3. create superadmin if that email is missing
 * Admin password is never overwritten on restart.
 *
 * Legacy: set DB_PUSH_ON_BOOT=1 to run `prisma db push` after migrate (not recommended on shared DBs).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    tableName,
  );
  return Boolean(rows[0]?.present);
}

async function schemaReady(prisma) {
  const user = await tableExists(prisma, "User");
  const templates = await tableExists(prisma, "EmailTemplate");
  return user && templates;
}

function runPrisma(args, label) {
  const script = path.join(__dirname, "packages/db/scripts/prisma-env.cjs");
  console.info(`[db] ${label}`);
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("[db] failed to start prisma:", result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[db] prisma ${args.join(" ")} failed`);
    process.exit(result.status ?? 1);
  }
}

function migrateDeploy(label) {
  runPrisma(["migrate", "deploy"], label);
  console.info("[db] migrations applied");
}

function pushSchema(label) {
  runPrisma(["db", "push", "--skip-generate"], label);
  console.info("[db] schema synced via db push");
}

async function ensureEmailTemplateTable(prisma) {
  if (await tableExists(prisma, "EmailTemplate")) return;
  console.info("[db] creating EmailTemplate table");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailTemplate" (
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_type_key" ON "EmailTemplate"("type")`,
  );
}

async function backfillTeamMembers(prisma) {
  if (!(await tableExists(prisma, "CPTeamMember"))) {
    console.info("[db] CPTeamMember table missing — skip backfill");
    return;
  }

  const leads = await prisma.lead.findMany({
    where: { fosName: { not: null }, teamMemberId: null },
    select: { id: true, cpId: true, fosName: true },
    take: 5000,
  });

  if (!leads.length) {
    console.info("[db] team member backfill — nothing to do");
    return;
  }

  const rosterMap = new Map();
  let linked = 0;

  for (const lead of leads) {
    const memberName = (lead.fosName || "").trim();
    if (!memberName) continue;
    const key = `${lead.cpId}|${memberName.toLowerCase()}`;

    let memberId = rosterMap.get(key);
    if (!memberId) {
      const existing = await prisma.cPTeamMember.findFirst({
        where: { cpId: lead.cpId, name: { equals: memberName, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        memberId = existing.id;
      } else {
        const created = await prisma.cPTeamMember.create({
          data: { cpId: lead.cpId, name: memberName, role: "FOS" },
          select: { id: true },
        });
        memberId = created.id;
      }
      rosterMap.set(key, memberId);
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { teamMemberId: memberId },
    });
    linked += 1;
  }

  console.info(`[db] team member backfill — linked ${linked} leads, ${rosterMap.size} roster entries`);
}

async function ensureSchema() {
  if (process.env.SKIP_DB_MIGRATE === "1" && process.env.DB_PUSH_ON_BOOT !== "1") {
    console.info("[db] SKIP_DB_MIGRATE=1 — skipping migrations");
    return;
  }

  const prisma = new PrismaClient();
  let migrateLabel = "applying pending Prisma migrations";
  try {
    migrateLabel = (await schemaReady(prisma))
      ? "applying pending Prisma migrations"
      : "first boot — applying Prisma migrations";
  } finally {
    await prisma.$disconnect();
  }

  if (process.env.SKIP_DB_MIGRATE !== "1") {
    migrateDeploy(migrateLabel);
  }

  if (process.env.DB_PUSH_ON_BOOT === "1") {
    pushSchema("optional schema sync with prisma db push");
  }

  const verify = new PrismaClient();
  try {
    await ensureEmailTemplateTable(verify);
    if (process.env.SKIP_TEAM_BACKFILL !== "1") {
      await backfillTeamMembers(verify);
    }
  } finally {
    await verify.$disconnect();
  }
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
