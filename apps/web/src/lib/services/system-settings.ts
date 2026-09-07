import { prisma } from "@goyal/db";
import {
  DEFAULT_COOLDOWN_DAYS,
  DEFAULT_LOCK_DAYS,
} from "@/lib/leads/phone";

export interface EoiRules {
  autoReview: boolean;
  requireCheque: boolean;
  minDeposit: string;
  maxPendingDays: string;
  allowCorrections: boolean;
  /** When true, phone/email identity lock + cooldown apply to CP punch. */
  leadPunchBlockingEnabled: boolean;
  /** Cross-CP lock window (days). */
  leadLockDays: string;
  /** Prior-CP cooldown after lock ends (days). */
  leadCooldownDays: string;
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
  announcements: boolean;
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

export type LeadLockPolicy = {
  enabled: boolean;
  lockDays: number;
  cooldownDays: number;
};

function clampDays(raw: string | number | undefined, fallback: number, max = 90): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(max, Math.floor(n));
}

/** Pure parser — used by getLeadLockPolicy and unit tests. */
export function parseLeadLockPolicyFromRules(
  eoiRules: Partial<EoiRules> | null | undefined,
): LeadLockPolicy {
  return {
    enabled: eoiRules?.leadPunchBlockingEnabled !== false,
    lockDays: Math.max(1, clampDays(eoiRules?.leadLockDays, DEFAULT_LOCK_DAYS)),
    cooldownDays: clampDays(eoiRules?.leadCooldownDays, DEFAULT_COOLDOWN_DAYS),
  };
}

/** Normalize lead-lock fields before persisting SystemSettings. */
export function normalizeEoiRulesLeadLock(eoiRules: EoiRules): EoiRules {
  const policy = parseLeadLockPolicyFromRules(eoiRules);
  return {
    ...eoiRules,
    leadPunchBlockingEnabled: policy.enabled,
    leadLockDays: String(policy.lockDays),
    leadCooldownDays: String(policy.cooldownDays),
  };
}

export const SYSTEM_SETTINGS_DEFAULTS: SystemSettingsData = {
  profile: { name: "", phone: "", supportEmail: "admin@goyalprojects.com" },
  notifications: {
    newEoi: true,
    cpRegistration: true,
    approvalReminders: true,
    projectUpdates: false,
    announcements: true,
    emailDigest: "daily",
  },
  eoiRules: {
    autoReview: false,
    requireCheque: true,
    minDeposit: "500000",
    maxPendingDays: "7",
    allowCorrections: true,
    leadPunchBlockingEnabled: true,
    leadLockDays: String(DEFAULT_LOCK_DAYS),
    leadCooldownDays: String(DEFAULT_COOLDOWN_DAYS),
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
  const mergedEoi = {
    ...SYSTEM_SETTINGS_DEFAULTS.eoiRules,
    ...(raw?.eoiRules as object || {}),
  } as EoiRules;
  return {
    profile: { ...SYSTEM_SETTINGS_DEFAULTS.profile, ...(raw?.profile as object || {}) },
    notifications: { ...SYSTEM_SETTINGS_DEFAULTS.notifications, ...(raw?.notifications as object || {}) },
    eoiRules: normalizeEoiRulesLeadLock(mergedEoi),
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

export async function getLeadLockPolicy(): Promise<LeadLockPolicy> {
  const { eoiRules } = await getSystemSettings();
  return parseLeadLockPolicyFromRules(eoiRules);
}

export function invalidateSystemSettingsCache() {
  cache = null;
}
