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
        "rounded-xl border border-border bg-surface p-3 shadow-sm sm:px-4 sm:py-3",
        className
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-3",
          "sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
        )}
      >
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:flex sm:flex-1 sm:flex-wrap sm:items-end sm:gap-3">
          {children}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
