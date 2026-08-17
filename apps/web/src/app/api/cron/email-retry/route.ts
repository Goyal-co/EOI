import { processEmailRetryQueue } from "@goyal/email";
import { apiResponse, apiError, withApiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export const POST = withApiRoute("cron.email-retry.post", async (req: Request) => {
  if (!isAuthorizedCron(req)) {
    return apiError("Unauthorized", 401);
  }

  const processed = await processEmailRetryQueue(25);
  return apiResponse({ processed });
});

export const GET = withApiRoute("cron.email-retry.get", async (req: Request) => {
  return POST(req);
});
