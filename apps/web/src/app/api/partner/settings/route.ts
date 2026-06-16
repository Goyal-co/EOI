import { prisma } from "@goyal/db";
import { partnerSettingsSchema } from "@goyal/types";
import { getSystemSettings } from "@/lib/services/system-settings";
import { withAuth, apiResponse, apiError } from "@/lib/api";

const DEFAULTS = {
  emailNotifications: true,
  inAppNotifications: true,
  pushNotifications: true,
  eoiUpdates: true,
  leadAlerts: true,
  profileVisible: true,
  shareAnalytics: false,
};

export async function GET() {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;

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
}

export async function PUT(req: Request) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;

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
}
