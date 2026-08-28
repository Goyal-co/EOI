import { prisma } from "@goyal/db";
import { apiResponse, apiError, withApiRoute } from "@/lib/api";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const checkStatusSchema = z.object({
  email: z.string().email(),
});

export const POST = withApiRoute("partner.check-status.post", async (req: Request) => {
  const ip = getClientIp(req);
  const limited = rateLimit(`check-status:${ip}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    return apiError("Too many requests. Try again later.", 429);
  }

  const body = await req.json();
  const parsed = checkStatusSchema.safeParse(body);
  if (!parsed.success) return apiError("Valid email is required");

  const user = await prisma.user.findFirst({
    where: { email: { equals: parsed.data.email.trim(), mode: "insensitive" } },
    include: { cpProfile: true, teamMemberProfile: true },
  });

  if (!user) {
    return apiResponse({ status: "invalid" as const });
  }

  if (user.role === "CP_TEAM_MEMBER") {
    if (!user.teamMemberProfile || user.teamMemberProfile.status !== "ACTIVE") {
      return apiResponse({ status: "invalid" as const });
    }
    if (user.status === "INACTIVE") {
      return apiResponse({ status: "invalid" as const });
    }
    return apiResponse({ status: "approved" as const });
  }

  if (user.role !== "CHANNEL_PARTNER" || !user.cpProfile) {
    return apiResponse({ status: "invalid" as const });
  }

  if (user.cpProfile.status === "BLOCKED") {
    return apiResponse({ status: "blocked" as const });
  }

  if (user.cpProfile.status === "PENDING") {
    return apiResponse({ status: "pending" as const, email: user.email });
  }

  return apiResponse({ status: "invalid" as const });
});
