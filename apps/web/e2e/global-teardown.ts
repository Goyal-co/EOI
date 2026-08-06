import { FullConfig } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const CP_EMAIL = process.env.E2E_CP_EMAIL || "work.goyalco@gmail.com";
const hashBak = resolve(__dirname, ".cp-hash.bak");

export default async function globalTeardown(_config: FullConfig) {
  if (!existsSync(hashBak)) return;
  const prisma = new PrismaClient();
  try {
    const oldHash = readFileSync(hashBak, "utf8");
    if (oldHash) {
      await prisma.user.update({
        where: { email: CP_EMAIL },
        data: { passwordHash: oldHash },
      });
    }
    unlinkSync(hashBak);
  } finally {
    await prisma.$disconnect();
  }
}
