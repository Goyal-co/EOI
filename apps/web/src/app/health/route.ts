import { withApiRoute } from "@/lib/api";
import { healthHeadResponse, runHealthCheck } from "@/lib/health-check";

export const dynamic = "force-dynamic";

export const GET = withApiRoute("health", runHealthCheck);
export const HEAD = withApiRoute("health.head", healthHeadResponse);
