import { withApiRoute } from "@/lib/api";
import { healthHeadResponse, runHealthCheck } from "@/lib/health-check";

export const dynamic = "force-dynamic";

export const GET = withApiRoute("health", (req: Request) => runHealthCheck(req));
export const HEAD = withApiRoute("health.head", (req: Request) => healthHeadResponse(req));
