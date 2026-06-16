import { prisma } from "@goyal/db";

async function main() {
  const logs = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      to: true,
      subject: true,
      type: true,
      status: true,
      error: true,
      providerId: true,
      createdAt: true,
    },
  });
  console.log("Recent email logs:", JSON.stringify(logs, null, 2));

  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  console.log("System notifications:", JSON.stringify(settings?.notifications, null, 2));
}

main().finally(() => prisma.$disconnect());
