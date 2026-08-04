const LOCK_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Normalize Indian mobiles to last 10 digits. */
export function normalizeMobile(mobile: string): string {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function phoneLockWindowMs(days = LOCK_DAYS) {
  return days * MS_PER_DAY;
}

export function daysRemainingUntil(unlockAt: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((unlockAt.getTime() - now.getTime()) / MS_PER_DAY));
}

export { LOCK_DAYS };
