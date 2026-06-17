import { cn } from "../lib/utils";
import { brand } from "../tokens";

export interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  portalLabel?: string;
  stats?: { label: string; value: string }[];
  className?: string;
}

export function AuthLayout({
  children,
  title = brand.appName,
  subtitle = brand.tagline,
  portalLabel,
  stats,
  className,
}: AuthLayoutProps) {
  return (
    <div className={cn("flex min-h-[100dvh] bg-background", className)}>
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex xl:w-[42%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.18),transparent_55%)]"
        />
        <div className="relative">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-hover text-sm font-bold shadow-sm">
              G
            </div>
            <div>
              <p className="text-lg font-semibold">{title}</p>
              {portalLabel && <p className="text-sm text-white/60">{portalLabel}</p>}
            </div>
          </div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            {subtitle}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            Streamline expression of interest across channel partners & customers.
          </p>
        </div>
        {stats && stats.length > 0 && (
          <div className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-semibold text-gold">{stat.value}</p>
                <p className="mt-1 text-xs text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-hover text-sm font-bold text-white">
              G
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {portalLabel && <p className="text-xs text-muted-foreground">{portalLabel}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-card sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
