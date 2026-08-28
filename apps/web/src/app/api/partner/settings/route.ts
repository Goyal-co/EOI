import { prisma } from "@goyal/db";
import { partnerSettingsSchema } from "@goyal/types";
import { getSystemSettings } from "@/lib/services/system-settings";
import {
  withPartnerAuth,
  apiResponse,
  apiError,
  requirePartnerOwner,
  withApiRoute,
} from "@/lib/api";

const DEFAULTS = {
  emailNotifications: true,
  inAppNotifications: true,
  pushNotifications: true,
  eoiUpdates: true,
  leadAlerts: true,
  profileVisible: true,
  shareAnalytics: false,
};

export const GET = withApiRoute("partner.settings.get", async () => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const ownerError = await requirePartnerOwner(session!);
  if (ownerError) return ownerError;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { preferences: true },
  });

  const stored = (user?.preferences as Record<string, boolean> | null) || {};
  const system = await getSystemSettings();

  return apiResponse({
    ...DEFAULTS,
    ...stored,
    permissions: {
      cpCanExportLeads: system.permissions.cpCanExportLeads,
      cpCanViewAnalytics: system.permissions.cpCanViewAnalytics,
    },
  });
});

export const PUT = withApiRoute("partner.settings.put", async (req: Request) => {
  const { error, session } = await withPartnerAuth();
  if (error) return error;
  const ownerError = await requirePartnerOwner(session!);
  if (ownerError) return ownerError;

  const body = await req.json();
  const parsed = partnerSettingsSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const existing = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { preferences: true },
  });

  const merged = {
    ...DEFAULTS,
    ...((existing?.preferences as Record<string, boolean> | null) || {}),
    ...parsed.data,
  };

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { preferences: merged },
  });

  return apiResponse(merged);
});
