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
            <div className="flex flex-col items-center mb-4">
              <img
                src={brand.logoSrc}
                alt="Goyal Hariyana"
                className="h-14 w-auto max-w-[300px] object-contain"
              />
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
