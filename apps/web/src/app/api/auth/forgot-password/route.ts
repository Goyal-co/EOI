import { randomBytes } from "crypto";
import { prisma } from "@goyal/db";
import { forgotPasswordSchema } from "@goyal/types";
import { apiResponse, apiError, withApiRoute } from "@/lib/api";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { getCustomerResetPasswordUrl, getPartnerResetPasswordUrl, passwordResetEmailHtml, sendEmailWithLog } from "@goyal/email";

export const POST = withApiRoute("auth.forgot-password", async (req: Request) => {
  const ip = getClientIp(req);
  const limited = await rateLimitAsync(`forgot-password:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many requests. Try again later.", 429);

  const body = await req.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const user = await prisma.user.findFirst({
    where: { email: { equals: parsed.data.email.trim(), mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  });

  if (user && (user.role === "CHANNEL_PARTNER" || user.role === "CUSTOMER")) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl =
      user.role === "CUSTOMER"
        ? getCustomerResetPasswordUrl(token)
        : getPartnerResetPasswordUrl(token);
    await sendEmailWithLog({
      to: user.email,
      subject: "Reset your password — Goyal & Co. | Hariyana Group",
      html: passwordResetEmailHtml({ resetUrl }),
      type: "PASSWORD_RESET",
    });
  }

  return apiResponse({ success: true, message: "If an account exists, a reset link has been sent." });
});
