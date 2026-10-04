/** Journey statuses that stay admin-only (not shown to channel partners). */
const HIDDEN_PARTNER_JOURNEY_STATUSES = new Set([
  "ACTIVE",
  "CONFIRMATION_PENDING",
]);

/** Return status for partner UI badges/filters, or null when it should be hidden. */
export function partnerVisibleJourneyStatus(
  status?: string | null,
): string | null {
  if (!status) return null;
  if (HIDDEN_PARTNER_JOURNEY_STATUSES.has(status)) return null;
  return status;
}

export function isPartnerHiddenJourneyStatus(status?: string | null): boolean {
  return Boolean(status && HIDDEN_PARTNER_JOURNEY_STATUSES.has(status));
}
