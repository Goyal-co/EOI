/** Defaults when SystemSettings has not overridden lead punch blocking. */
export const DEFAULT_LOCK_DAYS = 15;
export const DEFAULT_COOLDOWN_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Normalize Indian mobiles to last 10 digits. */
export function normalizeMobile(mobile: string): string {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function phoneLockWindowMs(days = DEFAULT_LOCK_DAYS) {
  return Math.max(1, days) * MS_PER_DAY;
}

export function priorCpCooldownMs(days = DEFAULT_COOLDOWN_DAYS) {
  return Math.max(0, days) * MS_PER_DAY;
}

export function daysRemainingUntil(unlockAt: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((unlockAt.getTime() - now.getTime()) / MS_PER_DAY));
}

/** @deprecated Use DEFAULT_LOCK_DAYS — kept for older imports. */
export const LOCK_DAYS = DEFAULT_LOCK_DAYS;
/** @deprecated Use DEFAULT_COOLDOWN_DAYS — kept for older imports. */
export const COOLDOWN_DAYS = DEFAULT_COOLDOWN_DAYS;
