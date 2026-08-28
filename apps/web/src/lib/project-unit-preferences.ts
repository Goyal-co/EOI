import type { ProjectUnitPreference } from "@goyal/types";

export function parseProjectUnitPreferences(raw: unknown): ProjectUnitPreference[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label = typeof (item as { label?: unknown }).label === "string"
        ? (item as { label: string }).label.trim()
        : "";
      const budgetRanges = Array.isArray((item as { budgetRanges?: unknown }).budgetRanges)
        ? (item as { budgetRanges: unknown[] }).budgetRanges
            .map((r) => (typeof r === "string" ? r.trim() : ""))
            .filter(Boolean)
        : [];
      if (!label || !budgetRanges.length) return null;
      return { label, budgetRanges };
    })
    .filter((item): item is ProjectUnitPreference => Boolean(item));
}

export function budgetRangesForUnit(
  preferences: ProjectUnitPreference[],
  unitLabel: string,
): string[] {
  const match = preferences.find((p) => p.label === unitLabel);
  return match?.budgetRanges ?? [];
}
