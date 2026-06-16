"use client";

import { Suspense } from "react";
import { useCustomerDashboard } from "@/lib/hooks";
import { ProjectSwitcher, useCustomerEoiId } from "./project-switcher";

function ProjectSwitcherInner() {
  const eoiId = useCustomerEoiId();
  const { data } = useCustomerDashboard(eoiId);

  if (!data?.hasEOI || !data.eois?.length) return null;

  return (
    <ProjectSwitcher
      entries={data.eois}
      activeEoiId={data.activeEoiId}
    />
  );
}

export function CustomerProjectSwitcher() {
  return (
    <Suspense fallback={null}>
      <ProjectSwitcherInner />
    </Suspense>
  );
}
