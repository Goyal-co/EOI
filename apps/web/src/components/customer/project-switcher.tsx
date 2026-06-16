"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@goyal/ui";
import { Building2 } from "lucide-react";

export interface CustomerProjectEntry {
  eoiId: string | null;
  project?: { name: string; id?: string };
  eoi?: { status?: string };
  cpName?: string | null;
}

interface ProjectSwitcherProps {
  entries: CustomerProjectEntry[];
  activeEoiId?: string | null;
}

export function ProjectSwitcher({ entries, activeEoiId }: ProjectSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (entries.length <= 1) return null;

  const value = activeEoiId || entries[0]?.eoiId || "";

  const handleChange = (eoiId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (eoiId) params.set("eoiId", eoiId);
    else params.delete("eoiId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">Project:</span>
      <Select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="max-w-xs text-sm"
        options={entries.map((entry) => ({
          value: entry.eoiId || "",
          label: `${entry.project?.name || "Project"}${entry.eoi?.status ? ` (${entry.eoi.status.replace(/_/g, " ")})` : ""}`,
        }))}
      />
    </div>
  );
}

export function useCustomerEoiId(): string | null {
  const searchParams = useSearchParams();
  return searchParams.get("eoiId");
}

export function customerPath(
  path: string,
  eoiId?: string | null,
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  if (eoiId) params.set("eoiId", eoiId);
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => params.set(key, value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
