import { prisma } from "@goyal/db";
import bcrypt from "bcryptjs";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "partner@goyalprojects.com" },
    include: { cpProfile: true, customerProfile: true },
  });

  if (!user) {
    console.log("user not found");
    return;
  }

  const password = "Partner@123";
  const valid = user.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  console.log({
    id: user.id,
    role: user.role,
    status: user.status,
    valid,
    cpProfile: user.cpProfile,
    blocked: user.cpProfile?.status === "BLOCKED",
    notApproved: user.cpProfile?.status !== "APPROVED",
    wouldAuthorize:
      valid &&
      (user.status === "ACTIVE" || user.status === "PENDING") &&
      user.role === "CHANNEL_PARTNER" &&
      user.cpProfile?.status !== "BLOCKED" &&
      user.cpProfile?.status === "APPROVED",
  });
}

main().finally(() => prisma.$disconnect());
