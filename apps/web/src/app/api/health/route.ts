import { withApiRoute } from "@/lib/api";
import { healthHeadResponse, runHealthCheck } from "@/lib/health-check";

export const dynamic = "force-dynamic";

/** Overall health for partnergoyalco.com and every portal host. */
export const GET = withApiRoute("api.health", (req: Request) =>
  runHealthCheck(req, { overall: true }),
);
export const HEAD = withApiRoute("api.health.head", (req: Request) =>
  healthHeadResponse(req, { overall: true }),
);
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "GET, HEAD, OPTIONS",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "cache-control": "no-store",
    },
  });
}
