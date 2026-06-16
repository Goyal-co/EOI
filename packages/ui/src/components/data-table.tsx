"use client";

import { cn } from "../lib/utils";
import { Card } from "./card";
import { LoadingSkeleton } from "./loading-skeleton";
import { EmptyState } from "./empty-state";
import { FilterBar } from "./filter-bar";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  filters?: React.ReactNode;
  filterActions?: React.ReactNode;
  className?: string;
  size?: "default" | "compact";
}

export function DataTable<T extends object>({
  columns,
  data,
  loading,
  emptyTitle = "No data found",
  emptyDescription,
  onRowClick,
  actions,
  filters,
  filterActions,
  className,
  size = "default",
}: DataTableProps<T>) {
  const cellPadding = size === "compact" ? "px-4 py-2" : "px-4 py-3";

  if (loading) {
    return (
      <Card className={cn("p-6", className)}>
        <LoadingSkeleton rows={5} />
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {filters && (
        <FilterBar actions={filterActions}>{filters}</FilterBar>
      )}
      {data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-blue-50/80">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      cellPadding,
                      "text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
                {actions && (
                  <th className={cn(cellPadding, "text-right text-xs font-semibold text-muted-foreground uppercase")}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border/60 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-blue-50/40"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn(cellPadding, "text-sm text-foreground align-top", col.className)}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  {actions && (
                    <td className={cn(cellPadding, "text-right")} onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
