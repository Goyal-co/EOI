import { randomBytes } from "crypto";
import { prisma } from "@goyal/db";
import { forgotPasswordSchema } from "@goyal/types";
import { apiResponse, apiError } from "@/lib/api";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { sendEmailWithLog } from "@goyal/email";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = await rateLimitAsync(`forgot-password:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many requests. Try again later.", 429);

  const body = await req.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true },
  });

  if (user && user.role === "CHANNEL_PARTNER") {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendEmailWithLog({
      to: parsed.data.email,
      subject: "Reset your password — Goyal & Co. | Hariyana Group",
      html: `<p>Click <a href="${baseUrl}/partner/reset-password/${token}">here</a> to reset your password. Link expires in 1 hour.</p>`,
      type: "PASSWORD_RESET",
    });
  }

  return apiResponse({ success: true, message: "If an account exists, a reset link has been sent." });
}
