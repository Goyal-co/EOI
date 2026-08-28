"use client";

import { useMemo } from "react";
import { Select } from "@goyal/ui";
import { usePartnerProjects } from "@/lib/hooks";
import { parseProjectUnitPreferences, budgetRangesForUnit } from "@/lib/project-unit-preferences";

interface ProjectUnitBudgetFieldsProps {
  projectId: string;
  configuration: string;
  budget: string;
  onConfigurationChange: (value: string) => void;
  onBudgetChange: (value: string) => void;
  configurationRequired?: boolean;
}

export function ProjectUnitBudgetFields({
  projectId,
  configuration,
  budget,
  onConfigurationChange,
  onBudgetChange,
  configurationRequired = false,
}: ProjectUnitBudgetFieldsProps) {
  const { data: projects } = usePartnerProjects();
  const unitPreferences = useMemo(() => {
    const project = (projects as Array<{ id: string; unitPreferences?: unknown }> | undefined)
      ?.find((p) => p.id === projectId);
    return parseProjectUnitPreferences(project?.unitPreferences);
  }, [projectId, projects]);

  const budgetOptions = useMemo(
    () => budgetRangesForUnit(unitPreferences, configuration),
    [unitPreferences, configuration],
  );

  const handleUnitChange = (value: string) => {
    onConfigurationChange(value);
    const ranges = budgetRangesForUnit(unitPreferences, value);
    if (ranges.length === 1) {
      onBudgetChange(ranges[0]);
    } else {
      onBudgetChange("");
    }
  };

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
        label={configurationRequired ? "Unit Preference" : "Unit Preference"}
        value={configuration || ""}
        onChange={(e) => handleUnitChange(e.target.value)}
        options={[
          { value: "", label: configurationRequired ? "Select unit preference" : "Select unit preference (optional)" },
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
