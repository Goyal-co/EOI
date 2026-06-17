import { prisma } from "@goyal/db";
import { projectSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { resolveProjectBannerUrl } from "@/lib/project-banner";

function normalizeLocationLink(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

export async function GET() {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const projects = await prisma.project.findMany({
    include: {
      _count: { select: { leads: true, eois: true, cpAccess: true } },
      eois: { where: { status: { in: ["APPROVED", "CLOSED"] } }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiResponse(
    await Promise.all(
      projects.map(async (p) => ({
        id: p.id,
        name: p.name,
        location: p.location,
        locationLink: p.locationLink,
        status: p.status,
        eoiStatus: p.eoiStatus,
        startingPrice: Number(p.startingPrice),
        possessionDate: p.possessionDate,
        bannerUrl: await resolveProjectBannerUrl(p.bannerUrl),
        eoiCount: p._count.eois,
        activeCPs: p._count.cpAccess,
        closures: p.eois.length,
        createdAt: p.createdAt,
      }))
    )
  );
}

export async function POST(req: Request) {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const { eoiRule, ...rest } = body;
  const parsed = projectSchema.safeParse(rest);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      locationLink: normalizeLocationLink(parsed.data.locationLink),
      amenities: parsed.data.amenities || [],
      faqs: parsed.data.faqs || [],
      possessionDate: parsed.data.possessionDate ? new Date(parsed.data.possessionDate) : null,
      bannerUrl: body.bannerUrl,
    },
  });

  if (eoiRule) {
    const { projectEoiRuleSchema } = await import("@goyal/types");
    const ruleParsed = projectEoiRuleSchema.safeParse(eoiRule);
    if (ruleParsed.success) {
      await prisma.eOIRule.create({
        data: {
          projectId: project.id,
          minBudget: ruleParsed.data.minBudget,
          requiredDocuments: ruleParsed.data.requiredDocuments || [],
        },
      });
    }
  }

  return apiResponse(project, 201);
}
