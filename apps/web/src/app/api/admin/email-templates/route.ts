import { prisma } from "@goyal/db";
import { emailTemplatePatchSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";

export async function GET() {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const templates = await prisma.emailTemplate.findMany({ orderBy: { type: "asc" } });
  return apiResponse(templates);
}

export async function PUT(req: Request) {
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
}
