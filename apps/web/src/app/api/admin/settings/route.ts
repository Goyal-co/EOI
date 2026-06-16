import { prisma } from "@goyal/db";
import { adminSettingsSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { getSystemSettings, invalidateSystemSettingsCache } from "@/lib/services/system-settings";
import { writeAudit, getIpFromRequest } from "@/lib/services/audit";

export async function GET() {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const settings = await getSystemSettings();

  return apiResponse({
    profile: {
      name: session!.user.name || "",
      email: session!.user.email,
      phone: settings.profile.phone,
      supportEmail: settings.profile.supportEmail,
    },
    notifications: settings.notifications,
    eoiRules: settings.eoiRules,
    permissions: settings.permissions,
  });
}

export async function PUT(req: Request) {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = adminSettingsSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  const { profile, notifications, eoiRules, permissions } = parsed.data;
  const existing = await getSystemSettings();

  const updated = await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      profile: profile || existing.profile,
      notifications: notifications || existing.notifications,
      eoiRules: eoiRules || existing.eoiRules,
      permissions: permissions || existing.permissions,
    },
    update: {
      ...(profile ? { profile: { ...existing.profile, ...profile } } : {}),
      ...(notifications ? { notifications: { ...existing.notifications, ...notifications } } : {}),
      ...(eoiRules ? { eoiRules: { ...existing.eoiRules, ...eoiRules } } : {}),
      ...(permissions ? { permissions: { ...existing.permissions, ...permissions } } : {}),
    },
  });

  invalidateSystemSettingsCache();

  if (profile?.name) {
    await prisma.user.update({
      where: { id: session!.user.id },
      data: { name: profile.name },
    });
  }

  await writeAudit({
    actorId: session!.user.id,
    action: "SYSTEM_SETTINGS_UPDATED",
    entityType: "SystemSettings",
    entityId: "default",
    metadata: {
      sections: [
        profile && "profile",
        notifications && "notifications",
        eoiRules && "eoiRules",
        permissions && "permissions",
      ].filter(Boolean),
    },
    ipAddress: getIpFromRequest(req),
  });

  return apiResponse(updated);
}
