import { cn } from "../lib/utils";
import { brand } from "../tokens";

export interface PublicPageCardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function PublicPageCard({ children, title, description, className }: PublicPageCardProps) {
  return (
    <div className={cn("min-h-screen flex items-center justify-center bg-background p-6", className)}>
      <div className="w-full max-w-lg">
        {(title || description) && (
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-hover text-white font-bold text-sm">
                G
              </div>
              <span className="font-semibold text-foreground">{brand.appName}</span>
            </div>
            {title && <h1 className="text-page-title">{title}</h1>}
            {description && <p className="text-caption mt-2">{description}</p>}
          </div>
        )}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          {children}
        </div>
      </div>
    </div>
  );
}
