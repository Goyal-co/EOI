import { prisma } from "@goyal/db";
import { partnerProfileSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

export async function GET() {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

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
  });
}

export async function PUT(req: Request) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const body = await req.json();
  const parsed = partnerProfileSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

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
}
