import { prisma } from "@goyal/db";
import { cpStatusUpdateSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, withApiRoute } from "@/lib/api";
import { getPartnerLoginUrl, NotificationService } from "@goyal/email";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";
import { DocumentService } from "@/lib/services/document";
export const GET = withApiRoute("admin.channel-partners.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const cp = await prisma.channelPartner.findUnique({
    where: { id },
    include: {
      user: true,
      documents: true,
      projectAccess: { include: { project: true } },
      leads: { include: { project: true, eoi: true } },
      eois: { include: { project: true } },
    },
  });
  if (!cp) return apiError("Channel Partner not found", 404);

  const documents = await prisma.document.findMany({
    where: { cpId: id },
    orderBy: { uploadedAt: "desc" },
  });

  const approved = cp.eois.filter((e) => e.status === "APPROVED").length;
  const total = cp.eois.length;

  return apiResponse({
    ...cp,
    documents,
    performance: {
      totalLeads: cp.leads.length,
      totalEOIs: total,
      approvedEOIs: approved,
      approvalRatio: total > 0 ? Math.round((approved / total) * 100) : 0,
      projectWise: cp.eois.reduce((acc, e) => {
        const key = e.project.name;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  });
});

export const PATCH = withApiRoute("admin.channel-partners.patch", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const body = await req.json();
  const parsed = cpStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);
  const { status, projectIds, blockReason } = parsed.data;
  const cp = await prisma.channelPartner.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!cp) return apiError("Channel Partner not found", 404);

  if (status === "BLOCKED" && !blockReason) {
    return apiError("Block reason is required when blocking a channel partner");
  }

  if (status === "APPROVED" && (!projectIds || projectIds.length === 0)) {
    return apiError("At least one project must be assigned when approving a channel partner");
  }

  if (!status && projectIds?.length) {
    if (cp.status !== "APPROVED") {
      return apiError("Projects can only be assigned to approved channel partners");
    }

    await prisma.$transaction(async (tx) => {
      await tx.cPProjectAccess.deleteMany({
        where: { cpId: id, projectId: { notIn: projectIds } },
      });
      for (const projectId of projectIds) {
        await tx.cPProjectAccess.upsert({
          where: { cpId_projectId: { cpId: id, projectId } },
          update: {},
          create: { cpId: id, projectId },
        });
      }
    });

    await writeAudit({
      actorId: session!.user.id,
      action: "CP_PROJECTS_ASSIGNED",
      entityType: "ChannelPartner",
      entityId: id,
      metadata: { projectIds },
      ipAddress: getIpFromRequest(req),
    });

    const updated = await prisma.channelPartner.findUnique({ where: { id } });
    return apiResponse(updated);
  }

  if (!status) {
    return apiError("No changes specified");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.channelPartner.update({
      where: { id },
      data: {
        status: status as never,
        blockReason: status === "BLOCKED" ? blockReason : status === "APPROVED" ? null : undefined,
      },
    });

    if (status === "APPROVED") {
      await tx.user.update({
        where: { id: cp.userId },
        data: { status: "ACTIVE" },
      });

      if (projectIds?.length) {
        for (const projectId of projectIds) {
          await tx.cPProjectAccess.upsert({
            where: { cpId_projectId: { cpId: id, projectId } },
            update: {},
            create: { cpId: id, projectId },
          });
        }
      }
    }

    return result;
  });

  if (status === "APPROVED" && cp.user) {
    const loginUrl = getPartnerLoginUrl();
    await NotificationService.notifyCPApproved({
      cpUserId: cp.user.id,
      cpEmail: cp.user.email,
      cpName: cp.user.name || "Partner",
      loginUrl,
    });
  }

  if (status) {
    await writeAudit({
      actorId: session!.user.id,
      action: `CP_${status}`,
      entityType: "ChannelPartner",
      entityId: id,
      metadata: { projectIds, previousStatus: cp.status, blockReason },
      ipAddress: getIpFromRequest(req),
    });
  }

  return apiResponse(updated);
});

export const DELETE = withApiRoute("admin.channel-partners.delete", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const cp = await prisma.channelPartner.findUnique({
    where: { id },
    include: {
      user: true,
      documents: { select: { fileUrl: true } },
      eois: { include: { documents: { select: { fileUrl: true } } } },
    },
  });
  if (!cp) return apiError("Channel Partner not found", 404);

  const fileUrls = [
    ...cp.documents.map((doc) => doc.fileUrl),
    ...cp.eois.flatMap((eoi) => eoi.documents.map((doc) => doc.fileUrl)),
  ].filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.approvalAction.deleteMany({ where: { eoi: { cpId: id } } });
    await tx.document.deleteMany({ where: { OR: [{ cpId: id }, { eoi: { cpId: id } }] } });
    await tx.eOI.deleteMany({ where: { cpId: id } });
    await tx.lead.deleteMany({ where: { cpId: id } });
    await tx.cPProjectAccess.deleteMany({ where: { cpId: id } });
    await tx.channelPartner.delete({ where: { id } });
    await tx.user.delete({ where: { id: cp.userId } });
    await tx.leadIdentity.deleteMany({ where: { leads: { none: {} } } });
  });

  await Promise.allSettled(fileUrls.map((fileUrl) => DocumentService.deleteStoredFile(fileUrl)));

  await writeAudit({
    actorId: session!.user.id,
    action: "CP_DELETED",
    entityType: "ChannelPartner",
    entityId: id,
    metadata: { email: cp.user.email, name: cp.user.name },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse({ success: true });
});
