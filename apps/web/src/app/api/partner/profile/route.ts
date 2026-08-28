import { prisma } from "@goyal/db";
import { partnerProfileSchema } from "@goyal/types";
import { withPartnerAuth, apiResponse, apiError, requireApprovedCP, withApiRoute } from "@/lib/api";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

export const GET = withApiRoute("partner.profile.get", async () => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  if (session!.user.role === "CP_TEAM_MEMBER") {
    const member = await prisma.cPTeamMember.findFirst({
      where: {
        userId: session!.user.id,
        cpId: session!.user.cpId,
        status: "ACTIVE",
      },
      include: { cp: { select: { companyName: true } } },
    });
    if (!member) return apiError("Team member profile not found", 404);
    return apiResponse({
      name: member.name,
      email: member.email,
      mobile: member.mobile,
      role: member.role,
      companyName: member.cp.companyName,
      isTeamMember: true,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { cpProfile: true },
  });
  if (!user?.cpProfile) return apiError("Partner profile not found", 404);

  return apiResponse({
    name: user.name,
    email: user.email,
    mobile: user.cpProfile.mobile,
    companyName: user.cpProfile.companyName,
    reraNumber: user.cpProfile.reraNumber,
    panNumber: user.cpProfile.panNumber,
    gstNumber: user.cpProfile.gstNumber,
    officeAddress: user.cpProfile.officeAddress,
    city: user.cpProfile.city,
    isTeamMember: false,
  });
});

export const PUT = withApiRoute("partner.profile.put", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const body = await req.json();
  const parsed = partnerProfileSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  if (session!.user.role === "CP_TEAM_MEMBER") {
    const member = await prisma.cPTeamMember.findFirst({
      where: { userId: session!.user.id, cpId: session!.user.cpId, status: "ACTIVE" },
    });
    if (!member) return apiError("Team member profile not found", 404);

    if (parsed.data.name) {
      await prisma.user.update({
        where: { id: session!.user.id },
        data: { name: parsed.data.name },
      });
    }

    const updated = await prisma.cPTeamMember.update({
      where: { id: member.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.mobile !== undefined ? { mobile: parsed.data.mobile } : {}),
      },
    });

    return apiResponse(updated);
  }

  const cp = await prisma.channelPartner.findUnique({
    where: { userId: session!.user.id },
  });
  if (!cp) return apiError("Partner profile not found", 404);

  if (parsed.data.name) {
    await prisma.user.update({
      where: { id: session!.user.id },
      data: { name: parsed.data.name },
    });
  }

  const updated = await prisma.channelPartner.update({
    where: { id: cp.id },
    data: {
      mobile: parsed.data.mobile,
      companyName: parsed.data.companyName,
      reraNumber: parsed.data.reraNumber,
      panNumber: parsed.data.panNumber,
      gstNumber: parsed.data.gstNumber,
      officeAddress: parsed.data.officeAddress,
      city: parsed.data.city,
    },
  });

  await writeAudit({
    actorId: session!.user.id,
    action: "PARTNER_PROFILE_UPDATED",
    entityType: "ChannelPartner",
    entityId: cp.id,
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse(updated);
});
