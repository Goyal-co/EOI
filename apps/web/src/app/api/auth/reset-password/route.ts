import bcrypt from "bcryptjs";
import { prisma } from "@goyal/db";
import { resetPasswordSchema } from "@goyal/types";
import { apiResponse, apiError } from "@/lib/api";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return apiError("Invalid or expired reset token", 400);
  }

  if (record.user.role !== "CHANNEL_PARTNER") {
    return apiError("Invalid reset token", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  });
  await prisma.passwordResetToken.delete({ where: { id: record.id } });

  return apiResponse({ success: true });
}
