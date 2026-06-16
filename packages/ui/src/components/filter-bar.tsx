import { cn } from "../lib/utils";

export interface FilterBarProps {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, actions, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border bg-blue-50/30 px-4 py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
