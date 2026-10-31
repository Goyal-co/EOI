import { prisma } from "@goyal/db";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { getAssignedPartnerProject, listAssignedPartnerProjects } from "@/lib/services/partner-projects";

export const GET = withApiRoute("partner.projects.get", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const cpId = session!.user.cpId!;
  const url = new URL(req.url);
  const slim = url.searchParams.get("slim") === "1";
  const projectId = (url.searchParams.get("id") || "").trim();

  if (slim) {
    const access = await prisma.cPProjectAccess.findMany({
      where: { cpId, ...(projectId ? { projectId } : {}) },
      select: {
        project: {
          select: {
            id: true,
            name: true,
            eoiStatus: true,
            eoiFormFiller: true,
            status: true,
            unitPreferences: true,
          },
        },
      },
    });
    const rows = access.map((a) => ({
      id: a.project.id,
      name: a.project.name,
      eoiStatus: a.project.eoiStatus,
      eoiFormFiller: a.project.eoiFormFiller,
      status: a.project.status,
      unitPreferences: a.project.unitPreferences,
    }));
    if (projectId) {
      const one = rows[0];
      if (!one) return apiError("Project not found or not assigned", 404);
      return apiResponse(one);
    }
    return apiResponse(rows);
  }

  if (projectId) {
    const result = await getAssignedPartnerProject(session!, projectId);
    if (result.error || !result.project) return apiError(result.error || "Project not found", result.status);
    return apiResponse(result.project);
  }

  return apiResponse(await listAssignedPartnerProjects(session!));
});
