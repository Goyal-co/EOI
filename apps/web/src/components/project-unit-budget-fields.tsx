"use client";

import { useMemo } from "react";
import { Select } from "@goyal/ui";
import { useQuery } from "@tanstack/react-query";
import { parseProjectUnitPreferences, budgetRangesForUnit } from "@/lib/project-unit-preferences";
import type { ProjectUnitPreference } from "@goyal/types";

interface ProjectUnitBudgetFieldsProps {
  projectId: string;
  configuration: string;
  budget: string;
  onConfigurationChange: (value: string) => void;
  onBudgetChange: (value: string) => void;
  configurationRequired?: boolean;
  /** When provided, skips the slim projects fetch for this project. */
  unitPreferences?: unknown;
}

async function fetchSlimProjects(): Promise<Array<{ id: string; unitPreferences?: unknown }>> {
  const res = await fetch("/api/partner/projects?slim=1");
  if (!res.ok) throw new Error("Failed to load project preferences");
  return res.json();
}

export function ProjectUnitBudgetFields({
  projectId,
  configuration,
  budget,
  onConfigurationChange,
  onBudgetChange,
  configurationRequired = false,
  unitPreferences: unitPreferencesProp,
}: ProjectUnitBudgetFieldsProps) {
  const needsFetch = unitPreferencesProp === undefined;
  const { data: slimProjects, isLoading, isError } = useQuery({
    queryKey: ["partner", "projects", "slim"],
    queryFn: fetchSlimProjects,
    enabled: needsFetch && Boolean(projectId),
    staleTime: 60_000,
  });

  const unitPreferences: ProjectUnitPreference[] = useMemo(() => {
    if (unitPreferencesProp !== undefined) {
      return parseProjectUnitPreferences(unitPreferencesProp);
    }
    const project = slimProjects?.find((p) => p.id === projectId);
    return parseProjectUnitPreferences(project?.unitPreferences);
  }, [projectId, slimProjects, unitPreferencesProp]);

  const budgetOptions = useMemo(
    () => budgetRangesForUnit(unitPreferences, configuration),
    [unitPreferences, configuration],
  );

  const handleUnitChange = (value: string) => {
    const ranges = budgetRangesForUnit(unitPreferences, value);
    const nextBudget = ranges.length === 1 ? ranges[0] : "";
    // Parents often update React state twice here; keep order deterministic and
    // rely on functional setState in callers so neither value is dropped.
    onConfigurationChange(value);
    onBudgetChange(nextBudget);
  };

  if (needsFetch && isLoading) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-3">
        Loading unit preferences…
      </p>
    );
  }

  if (needsFetch && isError) {
    return (
      <p className="text-sm text-destructive rounded-md border border-dashed border-border p-3">
        Could not load unit preferences. Try again.
      </p>
    );
  }

  if (!unitPreferences.length) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-3">
        No unit preferences configured for this project. Ask admin to add them under Project settings.
      </p>
    );
  }

  return (
    <>
      <Select
        label="Unit Preference"
        value={configuration || ""}
        onChange={(e) => handleUnitChange(e.target.value)}
        options={[
          {
            value: "",
            label: configurationRequired ? "Select unit preference" : "Select unit preference (optional)",
          },
          ...unitPreferences.map((p) => ({ value: p.label, label: p.label })),
        ]}
        required={configurationRequired}
      />
      <Select
        label="Budget Range"
        value={budget || ""}
        onChange={(e) => onBudgetChange(e.target.value)}
        disabled={!configuration}
        options={[
          { value: "", label: configuration ? "Select budget range" : "Select unit preference first" },
          ...budgetOptions.map((r) => ({ value: r, label: r })),
        ]}
      />
    </>
  );
}
