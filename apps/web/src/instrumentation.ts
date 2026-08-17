export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
    // Do not sync EmailTemplate here. Prisma logs P2021 at boot if the table
    // is missing (empty RDS). Schema + templates are applied in docker-bootstrap
    // before Next starts; admin /api/admin/email-templates can sync later.
  }
}
