import { prisma } from "@goyal/db";
import { emailTemplatePatchSchema } from "@goyal/types";
import { syncDefaultEmailTemplates } from "@goyal/email";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";

export const GET = withApiRoute("admin.email-templates.get", async (req: Request) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("sync") === "1") {
    const result = await syncDefaultEmailTemplates({ forceLeadEoiTemplates: true });
    const templates = await prisma.emailTemplate.findMany({ orderBy: { type: "asc" } });
    return apiResponse({ ...result, templates });
  }

  const templates = await prisma.emailTemplate.findMany({ orderBy: { type: "asc" } });
  return apiResponse(templates);
});

export const PUT = withApiRoute("admin.email-templates.put", async (req: Request) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = emailTemplatePatchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const template = await prisma.emailTemplate.upsert({
    where: { type: parsed.data.type },
    create: {
      type: parsed.data.type,
      subject: parsed.data.subject,
      body: parsed.data.body,
    },
    update: {
      subject: parsed.data.subject,
      body: parsed.data.body,
    },
  });

  return apiResponse(template);
});
