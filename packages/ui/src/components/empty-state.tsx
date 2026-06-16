import { Inbox } from "lucide-react";
import { Button } from "./button";

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 mb-4">
        {icon || <Inbox className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-section-title">{title}</h3>
      {description && <p className="text-caption mt-1 text-center max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="gold" className="mt-4" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
