import { apiError, withApiRoute } from "@/lib/api";
import { handlers } from "@goyal/auth";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const { GET, POST: authPOST } = handlers;

export { GET };

export const POST = withApiRoute("auth.nextauth.post", async (req: NextRequest) => {
  const url = new URL(req.url);
  const isCredentialsLogin = url.pathname.includes("/callback/credentials");

  if (isCredentialsLogin && process.env.NODE_ENV === "production") {
    const ip = getClientIp(req);
    const limited = await rateLimitAsync(`auth:${ip}`, 10, 15 * 60 * 1000);
    if (!limited.ok) {
      return apiError("Too many login attempts. Please try again later.", 429);
    }
  }

  return authPOST(req);
});
