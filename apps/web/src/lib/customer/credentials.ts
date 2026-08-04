import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@goyal/db";

/** Create or update a CUSTOMER user with a temporary password for portal login. */
export async function ensureCustomerCredentials(params: {
  email: string;
  name: string;
  mobile: string;
}): Promise<{ password: string; created: boolean; userId: string }> {
  const email = params.email.trim().toLowerCase();
  const password = `Gh${randomBytes(4).toString("hex")}@${Math.floor(100 + Math.random() * 900)}`;
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { customerProfile: true },
  });

  if (existing) {
    if (existing.role !== "CUSTOMER") {
      throw new Error("This email is registered under a different portal role");
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        name: params.name || existing.name,
        status: "ACTIVE",
      },
    });
    if (!existing.customerProfile) {
      await prisma.customer.create({
        data: {
          userId: existing.id,
          fullName: params.name,
          mobile: params.mobile,
        },
      });
    } else {
      await prisma.customer.update({
        where: { id: existing.customerProfile.id },
        data: {
          fullName: params.name || existing.customerProfile.fullName,
          mobile: params.mobile || existing.customerProfile.mobile,
        },
      });
    }
    return { password, created: false, userId: existing.id };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: params.name,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      customerProfile: {
        create: {
          fullName: params.name,
          mobile: params.mobile,
        },
      },
    },
  });

  return { password, created: true, userId: user.id };
}
