import { FullConfig } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CP_EMAIL = process.env.E2E_CP_EMAIL || "work.goyalco@gmail.com";
const TEMP_PASS = process.env.E2E_CP_PASSWORD || "UiPunch@2026";
const hashBak = resolve(__dirname, ".cp-hash.bak");

export default async function globalSetup(_config: FullConfig) {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: CP_EMAIL } });
    if (!user) throw new Error(`E2E CP not found: ${CP_EMAIL}`);
    writeFileSync(hashBak, user.passwordHash || "", "utf8");
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(TEMP_PASS, 12), status: "ACTIVE" },
    });
    process.env.E2E_CP_EMAIL = CP_EMAIL;
    process.env.E2E_CP_PASSWORD = TEMP_PASS;
  } finally {
    await prisma.$disconnect();
  }
}
