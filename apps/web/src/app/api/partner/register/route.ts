import bcrypt from "bcryptjs";
import { prisma } from "@goyal/db";
import { cpRegisterStep1Schema, cpRegisterStep2Schema } from "@goyal/types";
import { apiResponse, apiError } from "@/lib/api";
import { NotificationService } from "@goyal/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isUniqueConstraintError } from "@goyal/db";
import { checkCpRegistrationEmail } from "@/lib/registration/email-conflict";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many registration attempts. Try again later.", 429);

  const body = await req.json();
  const { step, data } = body;

  if (step === 1) {
    const parsed = cpRegisterStep1Schema.safeParse(data);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const emailCheck = await checkCpRegistrationEmail(parsed.data.email);
    if (!emailCheck.allowed) {
      return apiError(emailCheck.message || "Email already registered", 409, emailCheck.code);
    }

    return apiResponse({
      valid: true,
      accountConversion: !!emailCheck.convertUserId,
      leadRecordExists: !!emailCheck.leadOnly,
      notice: emailCheck.message,
    });
  }

  if (step === 2) {
    const parsed = cpRegisterStep2Schema.safeParse(data);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);
    return apiResponse({ valid: true });
  }

  if (step === 3) {
    const step1 = cpRegisterStep1Schema.safeParse(data.step1);
    const step2 = cpRegisterStep2Schema.safeParse(data.step2);
    if (!step1.success) return apiError(step1.error.errors[0].message);
    if (!step2.success) return apiError(step2.error.errors[0].message);

    const emailCheck = await checkCpRegistrationEmail(step1.data.email);
    if (!emailCheck.allowed) {
      return apiError(emailCheck.message || "Email already registered", 409, emailCheck.code);
    }

    const passwordHash = await bcrypt.hash(step1.data.password, 12);

    try {
      let userId: string;

      if (emailCheck.convertUserId) {
        const user = await prisma.$transaction(async (tx) => {
          const customer = await tx.customer.findUnique({
            where: { userId: emailCheck.convertUserId! },
          });
          if (customer) {
            await tx.lead.updateMany({
              where: { customerId: customer.id },
              data: { customerId: null },
            });
            await tx.customer.delete({ where: { id: customer.id } });
          }

          return tx.user.update({
            where: { id: emailCheck.convertUserId! },
            data: {
              passwordHash,
              name: step1.data.fullName,
              role: "CHANNEL_PARTNER",
              status: "PENDING",
              cpProfile: {
                create: {
                  companyName: step2.data.companyName || null,
                  mobile: step1.data.mobile,
                  reraNumber: step2.data.reraNumber,
                  panNumber: step2.data.panNumber,
                  gstNumber: step2.data.gstNumber || null,
                  status: "PENDING",
                },
              },
            },
            include: { cpProfile: true },
          });
        });
        userId = user.id;
      } else {
        const user = await prisma.user.create({
          data: {
            email: step1.data.email,
            passwordHash,
            name: step1.data.fullName,
            role: "CHANNEL_PARTNER",
            status: "PENDING",
            cpProfile: {
              create: {
                companyName: step2.data.companyName || null,
                mobile: step1.data.mobile,
                reraNumber: step2.data.reraNumber,
                panNumber: step2.data.panNumber,
                gstNumber: step2.data.gstNumber || null,
                status: "PENDING",
              },
            },
          },
          include: { cpProfile: true },
        });
        userId = user.id;
      }

      await NotificationService.notifyCPRegistrationAck({
        cpEmail: step1.data.email,
        cpName: step1.data.fullName,
      });

      const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
      for (const admin of admins) {
        await NotificationService.notifyCPRegistered({
          adminUserId: admin.id,
          cpName: step1.data.fullName,
          companyName: step2.data.companyName,
        });
      }

      return apiResponse({ success: true, userId }, 201);
    } catch (error) {
      if (isUniqueConstraintError(error, "email")) {
        return apiError("Email already registered", 409, "DUPLICATE_EMAIL");
      }
      throw error;
    }
  }

  return apiError("Invalid step");
}
