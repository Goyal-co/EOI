import { handlers } from "@goyal/auth";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const { GET, POST: authPOST } = handlers;

export { GET };

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const isCredentialsLogin = url.pathname.includes("/callback/credentials");

  if (isCredentialsLogin && process.env.NODE_ENV === "production") {
    const ip = getClientIp(req);
    const limited = await rateLimitAsync(`auth:${ip}`, 10, 15 * 60 * 1000);
    if (!limited.ok) {
      return new Response(
        JSON.stringify({ error: "Too many login attempts. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(limited.retryAfter ?? 60),
          },
        }
      );
    }
  }

  return authPOST(req);
}
