/** Normalize email for storage and duplicate checks */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
