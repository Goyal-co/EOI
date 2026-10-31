import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { getAssignedPartnerProject } from "@/lib/services/partner-projects";

/** GET /api/partner/projects/:id — same loader as ?id= for existing and new projects. */
export const GET = withApiRoute(
  "partner.projects.id.get",
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { error, session } = await withPartnerAuth();
    if (error) return error;
    const cpError = await requireApprovedCP(session!);
    if (cpError) return cpError;

    const { id: rawId } = await params;
    const id = decodeURIComponent(String(rawId || "")).trim();
    const result = await getAssignedPartnerProject(session!, id);
    if (result.error || !result.project) return apiError(result.error || "Project not found", result.status);
    return apiResponse(result.project);
  },
);
