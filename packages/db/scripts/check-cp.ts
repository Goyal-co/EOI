import { prisma } from "@goyal/db";
import bcrypt from "bcryptjs";

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: "partner@goyalprojects.com" },
    include: { cpProfile: true },
  });
  console.log(
    JSON.stringify(
      {
        exists: !!u,
        status: u?.status,
        role: u?.role,
        cpStatus: u?.cpProfile?.status,
        hasHash: !!u?.passwordHash,
        passwordMatch: u?.passwordHash
          ? await bcrypt.compare("Partner@123", u.passwordHash)
          : false,
      },
      null,
      2
    )
  );
}

main()
  .finally(() => prisma.$disconnect());
