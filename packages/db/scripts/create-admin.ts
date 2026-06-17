import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const email = process.env.ADMIN_EMAIL ?? process.argv[2];
const password = process.env.ADMIN_PASSWORD ?? process.argv[3];
const name = process.env.ADMIN_NAME ?? process.argv[4] ?? "Super Admin";

if (!email?.trim() || !password?.trim()) {
  console.error("Usage:");
  console.error("  ADMIN_EMAIL=you@co.com ADMIN_PASSWORD=secret npx tsx scripts/create-admin.ts");
  console.error("  npx tsx scripts/create-admin.ts you@co.com secret \"Your Name\"");
  process.exit(1);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("Set DATABASE_URL to your Neon connection string first.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", status: "ACTIVE", name },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      adminProfile: { create: {} },
    },
  });
  console.log("Admin ready:", email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
