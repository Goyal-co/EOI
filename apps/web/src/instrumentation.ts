export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
    // Do not sync EmailTemplate here. Prisma logs P2021 at boot if the table
    // is missing (empty RDS). Schema + templates are applied in docker-bootstrap
    // before Next starts; admin /api/admin/email-templates can sync later.
  }
}

export async function onRequestError(
  err: { digest?: string } & Error,
  request: { path: string; method: string; headers: { [key: string]: string | string[] } },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const { logServerError } = await import("./lib/server-log");
  logServerError(
    `next.${context.routeType}`,
    err.message || "Unhandled request error",
    {
      method: request.method,
      path: request.path,
      route: context.routePath,
      router: context.routerKind,
      digest: err.digest,
      status: 500,
    },
    err,
  );
}
