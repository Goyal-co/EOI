import { cn } from "../lib/utils";

export function LoadingSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-lg bg-border" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-border" />
            <div className="h-3 w-1/2 rounded bg-border" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-5 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-border mb-4" />
      <div className="h-8 w-1/2 rounded bg-border mb-2" />
      <div className="h-3 w-2/3 rounded bg-border" />
    </div>
  );
}
