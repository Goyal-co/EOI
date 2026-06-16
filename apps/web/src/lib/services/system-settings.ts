import { prisma } from "@goyal/db";

export interface EoiRules {
  autoReview: boolean;
  requireCheque: boolean;
  minDeposit: string;
  maxPendingDays: string;
  allowCorrections: boolean;
}

export interface Permissions {
  cpCanViewAnalytics: boolean;
  cpCanExportLeads: boolean;
  customerCanEditEOI: boolean;
  requireAdminApproval: boolean;
}

export interface NotificationSettings {
  newEoi: boolean;
  cpRegistration: boolean;
  approvalReminders: boolean;
  projectUpdates: boolean;
  emailDigest: string;
}

export interface SystemProfile {
  name: string;
  phone: string;
  supportEmail: string;
}

export interface SystemSettingsData {
  profile: SystemProfile;
  notifications: NotificationSettings;
  eoiRules: EoiRules;
  permissions: Permissions;
}

export const SYSTEM_SETTINGS_DEFAULTS: SystemSettingsData = {
  profile: { name: "", phone: "", supportEmail: "admin@goyalprojects.com" },
  notifications: {
    newEoi: true,
    cpRegistration: true,
    approvalReminders: true,
    projectUpdates: false,
    emailDigest: "daily",
  },
  eoiRules: {
    autoReview: false,
    requireCheque: true,
    minDeposit: "500000",
    maxPendingDays: "7",
    allowCorrections: true,
  },
  permissions: {
    cpCanViewAnalytics: true,
    cpCanExportLeads: false,
    customerCanEditEOI: true,
    requireAdminApproval: true,
  },
};

let cache: { data: SystemSettingsData; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

function mergeSettings(raw: {
  profile?: unknown;
  notifications?: unknown;
  eoiRules?: unknown;
  permissions?: unknown;
} | null): SystemSettingsData {
  return {
    profile: { ...SYSTEM_SETTINGS_DEFAULTS.profile, ...(raw?.profile as object || {}) },
    notifications: { ...SYSTEM_SETTINGS_DEFAULTS.notifications, ...(raw?.notifications as object || {}) },
    eoiRules: { ...SYSTEM_SETTINGS_DEFAULTS.eoiRules, ...(raw?.eoiRules as object || {}) },
    permissions: { ...SYSTEM_SETTINGS_DEFAULTS.permissions, ...(raw?.permissions as object || {}) },
  };
}

export async function getSystemSettings(): Promise<SystemSettingsData> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const data = mergeSettings(settings);
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function invalidateSystemSettingsCache() {
  cache = null;
}
