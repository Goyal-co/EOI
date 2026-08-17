import { prisma } from "@goyal/db";
import { leadPatchSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";

function resolveSiteVisit(data: {
  siteVisitStatus?: "NOT_SCHEDULED" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  siteVisitDate?: string | null;
}) {
  const patch: {
    siteVisitStatus?: "NOT_SCHEDULED" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
    siteVisitDate?: Date | null;
  } = {};

  if (data.siteVisitDate !== undefined) {
    if (!data.siteVisitDate) {
      patch.siteVisitDate = null;
    } else {
      const date = new Date(data.siteVisitDate.includes("T") ? data.siteVisitDate : `${data.siteVisitDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid site visit date");
      }
      patch.siteVisitDate = date;
    }
  }

  if (data.siteVisitStatus !== undefined) {
    patch.siteVisitStatus = data.siteVisitStatus;
  }

  const status = patch.siteVisitStatus;
  const visitDate = patch.siteVisitDate;

  if (status === "NOT_SCHEDULED") {
    patch.siteVisitDate = null;
  }

  // Partners may schedule a visit; COMPLETED is set only via reception webhook — never auto-complete by date.
  if (status === "SCHEDULED" || (status === undefined && visitDate)) {
    patch.siteVisitStatus = "SCHEDULED";
  }

  // Partners cannot mark COMPLETED themselves through this route.
  if (status === "COMPLETED") {
    throw new Error("Site visit can only be marked completed from reception");
  }

  return patch;
}

export const PATCH = withApiRoute("partner.leads.patch", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;
  const body = await req.json();
  const parsed = leadPatchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const lead = await prisma.lead.findFirst({
    where: { id, cpId: session!.user.cpId! },
  });
  if (!lead) return apiError("Lead not found", 404);

  if (
    lead.siteVisitStatus === "COMPLETED"
    && (parsed.data.siteVisitStatus !== undefined || parsed.data.siteVisitDate !== undefined)
  ) {
    return apiError(
      "Site visit already completed by reception and cannot be changed by partner",
      409,
    );
  }

  let patch;
  try {
    patch = resolveSiteVisit(parsed.data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Invalid site visit update", 400, undefined, { cause: e });
  }

  if (parsed.data.siteVisitStatus === "SCHEDULED" && !parsed.data.siteVisitDate && !lead.siteVisitDate) {
    return apiError("Site visit date is required when scheduling");
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: patch,
  });

  return apiResponse(updated);
});
