import { prisma } from "@goyal/db";
import { normalizeEmail } from "@goyal/types";

export type CpEmailConflictCode =
  | "DUPLICATE_CP"
  | "DUPLICATE_ADMIN"
  | "DUPLICATE_CUSTOMER"
  | "CUSTOMER_HAS_ACTIVE_EOI";

export interface CpEmailCheckResult {
  allowed: boolean;
  code?: CpEmailConflictCode;
  message?: string;
  /** Existing CP user id when a previous attempt created the account but docs failed */
  resumeUserId?: string;
  /** Existing customer user id that will be converted to a Channel Partner */
  convertUserId?: string;
  leadOnly?: boolean;
}

const BLOCKING_EOI_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "CLOSED"] as const;

export async function checkCpRegistrationEmail(email: string): Promise<CpEmailCheckResult> {
  const normalized = normalizeEmail(email);

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  if (!existingUser) {
    const leadCount = await prisma.lead.count({
      where: { customerEmail: { equals: normalized, mode: "insensitive" } },
    });
    return {
      allowed: true,
      leadOnly: leadCount > 0,
    };
  }

  if (existingUser.role === "CHANNEL_PARTNER") {
    const cp = await prisma.channelPartner.findUnique({
      where: { userId: existingUser.id },
      include: { _count: { select: { documents: true } } },
    });
    if (cp?.status === "PENDING" && cp._count.documents === 0) {
      return {
        allowed: true,
        resumeUserId: existingUser.id,
        message: "Previous registration was incomplete. Submit again to attach your documents.",
      };
    }
    return {
      allowed: false,
      code: "DUPLICATE_CP",
      message: "This email is already registered as a Channel Partner. Sign in or use a different email.",
    };
  }

  if (existingUser.role === "ADMIN") {
    return {
      allowed: false,
      code: "DUPLICATE_ADMIN",
      message: "This email is already registered as an admin account.",
    };
  }

  if (existingUser.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: existingUser.id },
      select: { id: true },
    });

    const blockingEois = customer
      ? await prisma.eOI.count({
          where: {
            customerId: customer.id,
            status: { in: [...BLOCKING_EOI_STATUSES] },
          },
        })
      : 0;

    if (blockingEois > 0) {
      return {
        allowed: false,
        code: "CUSTOMER_HAS_ACTIVE_EOI",
        message:
          "This email is linked to a customer account with an active EOI. Use a different email for partner registration.",
      };
    }

    return {
      allowed: true,
      convertUserId: existingUser.id,
      message:
        "This email was used for customer sign-in. Your account will be converted to a Channel Partner application.",
    };
  }

  return {
    allowed: false,
    code: "DUPLICATE_CUSTOMER",
    message: "Email already registered",
  };
}
