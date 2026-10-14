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
  /** Stable row id for selection. Required when selectable. */
  getRowId?: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** When set, only these rows can be selected (others show disabled checkbox). */
  isRowSelectable?: (row: T) => boolean;
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
  getRowId,
  selectable,
  selectedIds = [],
  onSelectionChange,
  isRowSelectable,
}: DataTableProps<T>) {
  const cellPadding = size === "compact" ? "px-4 py-2" : "px-4 py-3";
  const selectionEnabled = Boolean(selectable && getRowId && onSelectionChange);

  const selectableRows = selectionEnabled
    ? data.filter((row) => (isRowSelectable ? isRowSelectable(row) : true))
    : [];
  const selectableIds = selectableRows.map((row) => getRowId!(row));
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const someSelected =
    selectableIds.some((id) => selectedIds.includes(id)) && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !selectableIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...selectableIds]);
      onSelectionChange([...merged]);
    }
  };

  const toggleOne = (id: string, enabled: boolean) => {
    if (!onSelectionChange || !enabled) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

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
        <FilterBar
          actions={filterActions}
          className="rounded-none border-0 border-b border-border bg-transparent shadow-none"
        >
          {filters}
        </FilterBar>
      )}
      {data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-blue-50/80">
                {selectionEnabled && (
                  <th className={cn(cellPadding, "w-10")}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Select all"
                      disabled={selectableIds.length === 0}
                    />
                  </th>
                )}
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
              {data.map((row, i) => {
                const rowId = selectionEnabled ? getRowId!(row) : String(i);
                const canSelect = selectionEnabled
                  ? isRowSelectable
                    ? isRowSelectable(row)
                    : true
                  : false;
                return (
                  <tr
                    key={rowId}
                    className={cn(
                      "border-b border-border/60 transition-colors",
                      onRowClick && "cursor-pointer hover:bg-blue-50/40",
                      selectionEnabled && selectedIds.includes(rowId) && "bg-blue-50/50"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectionEnabled && (
                      <td
                        className={cn(cellPadding, "w-10")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={selectedIds.includes(rowId)}
                          disabled={!canSelect}
                          onChange={() => toggleOne(rowId, canSelect)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
