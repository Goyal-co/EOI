import { prisma } from "@goyal/db";

const CATEGORY_PREF_MAP: Record<string, string> = {
  NEW_EOI_SUBMITTED: "newEoi",
  APPROVAL_PENDING: "approvalReminders",
  PROJECT_STATUS_UPDATED: "projectUpdates",
  CP_REGISTERED: "cpRegistration",
  EOI_APPROVED: "eoiUpdates",
  EOI_REJECTED: "eoiUpdates",
  CUSTOMER_SUBMITTED_EOI: "eoiUpdates",
  CUSTOMER_REJECTED_CP: "leadAlerts",
  CORRECTION_REQUESTED: "eoiUpdates",
  CP_APPROVED: "eoiUpdates",
  CUSTOMER_CONFIRMATION: "leadAlerts",
  EOI_INVITATION: "eoiUpdates",
  CP_REGISTRATION_ACK: "cpRegistration",
};

const TRANSACTIONAL_EMAIL_TYPES = new Set([
  "CUSTOMER_CONFIRMATION",
  "LEAD_ONLY_ACCEPTED",
  "EOI_INVITATION",
  "EOI_SUBMITTED",
  "EOI_APPROVED",
  "EOI_REJECTED",
  "CORRECTION_REQUESTED",
  "CP_REGISTRATION_ACK",
  "CP_APPROVED",
]);

export function isTransactionalEmailType(notificationType: string): boolean {
  return TRANSACTIONAL_EMAIL_TYPES.has(notificationType);
}

async function getSystemNotificationPrefs(): Promise<Record<string, boolean | string>> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  return (settings?.notifications as Record<string, boolean | string> | null) || {};
}

async function getUserPrefs(userId: string | undefined): Promise<Record<string, boolean>> {
  if (!userId) return {};
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  return (user?.preferences as Record<string, boolean> | null) || {};
}

function isCategoryEnabled(
  prefs: Record<string, boolean>,
  system: Record<string, boolean | string>,
  category: string | undefined,
): boolean {
  if (!category) return true;
  if (prefs[category] === false) return false;
  if (system[category] === false) return false;
  return true;
}

export async function shouldSendEmail(userId: string | undefined, notificationType: string): Promise<boolean> {
  if (isTransactionalEmailType(notificationType)) return true;
  const category = CATEGORY_PREF_MAP[notificationType];
  if (!category) return true;

  const prefs = await getUserPrefs(userId);
  if (prefs.emailNotifications === false) return false;

  const system = await getSystemNotificationPrefs();
  return isCategoryEnabled(prefs, system, category);
}

export async function shouldCreateInAppNotification(
  userId: string | undefined,
  notificationType: string,
): Promise<boolean> {
  const category = CATEGORY_PREF_MAP[notificationType];
  const prefs = await getUserPrefs(userId);
  if (prefs.inAppNotifications === false) return false;
  if (prefs.pushNotifications === false) return false;
  const system = await getSystemNotificationPrefs();
  return isCategoryEnabled(prefs, system, category);
}

export async function isAdminNotificationEnabled(key: "approvalReminders" | "projectUpdates"): Promise<boolean> {
  const system = await getSystemNotificationPrefs();
  return system[key] !== false;
}

export async function getSupportEmail(): Promise<string> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const profile = (settings?.profile as { supportEmail?: string } | null) || {};
  return profile.supportEmail || "admin@goyalprojects.com";
}
