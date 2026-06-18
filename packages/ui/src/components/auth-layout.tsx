"use client";

import { cn } from "../lib/utils";
import { brand } from "../tokens";
import type { LucideIcon } from "lucide-react";
import { Building2, Shield } from "lucide-react";

export interface AuthFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface AuthStat {
  label: string;
  value: string;
  icon?: LucideIcon;
}

export interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  portalLabel?: string;
  tagline?: string;
  description?: string;
  stats?: AuthStat[];
  features?: AuthFeature[];
  legacyCard?: { title: string; body: string };
  backgroundImage?: string;
  formCardTitle?: string;
  formCardSubtitle?: string;
  formCardIcon?: LucideIcon;
  highlightSubtitle?: string;
  /** Place feature grid at bottom of left panel (admin-style layout) */
  featuresPosition?: "inline" | "bottom";
  /** Short gold divider below description */
  showDescriptionDivider?: boolean;
  className?: string;
}

function BrandHeader({
  title,
  portalLabel,
  compact,
}: {
  title: string;
  portalLabel?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "mb-6" : "mb-10")}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-hover text-sm font-bold text-white shadow-sm">
        G
      </div>
      <div>
        <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-lg")}>{title}</p>
        {portalLabel && (
          <p className={cn("text-gold font-medium", compact ? "text-xs" : "text-sm")}>{portalLabel}</p>
        )}
      </div>
    </div>
  );
}

export function AuthLayout({
  children,
  title = brand.appName,
  subtitle = brand.tagline,
  portalLabel,
  tagline = "BUILDING TRUST. CREATING LANDMARKS.",
  description = "Streamline expression of interest across channel partners & customers.",
  stats,
  features,
  legacyCard,
  backgroundImage,
  formCardTitle,
  formCardSubtitle,
  formCardIcon: FormCardIcon = Shield,
  highlightSubtitle,
  featuresPosition = "inline",
  showDescriptionDivider = false,
  className,
}: AuthLayoutProps) {
  const isMarketing = Boolean(backgroundImage);

  if (!isMarketing) {
    return (
      <div className={cn("flex min-h-[100dvh] bg-background", className)}>
        <aside className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex xl:w-[42%]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.18),transparent_55%)]"
          />
          <div className="relative">
            <BrandHeader title={title} portalLabel={portalLabel} />
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">{subtitle}</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">{description}</p>
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
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <BrandHeader title={title} portalLabel={portalLabel} compact />
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface p-6 shadow-card sm:p-8">{children}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className={cn("relative min-h-[100dvh] bg-[#f8f6f2]", className)}
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-white/55 backdrop-blur-[0.5px]" aria-hidden="true" />

      <div className="relative flex min-h-[100dvh] flex-col lg:flex-row">
        {/* Marketing panel */}
        <aside className="hidden w-[48%] shrink-0 flex-col justify-between p-10 xl:p-12 lg:flex">
          <div>
            <BrandHeader title={title} portalLabel={portalLabel} />
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
              <Building2 className="h-4 w-4" />
              {tagline}
            </div>
            <h2 className="max-w-lg font-serif text-4xl leading-tight text-navy xl:text-[2.75rem]">
              {highlightSubtitle ? (
                <>
                  {subtitle.split(highlightSubtitle)[0]}
                  <span className="text-gold">{highlightSubtitle}</span>
                  {subtitle.split(highlightSubtitle)[1]}
                </>
              ) : (
                subtitle
              )}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
            {(showDescriptionDivider || featuresPosition === "bottom") && (
              <div className="mt-6 h-0.5 w-12 rounded-full bg-gold" aria-hidden="true" />
            )}

            {features && features.length > 0 && featuresPosition === "inline" && (
              <div className="mt-10 grid gap-6 sm:grid-cols-3">
                {features.map(({ icon: Icon, title: featTitle, description: featDesc }) => (
                  <div key={featTitle}>
                    <Icon className="mb-2 h-5 w-5 text-gold" />
                    <p className="text-sm font-semibold text-foreground">{featTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{featDesc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {features && features.length > 0 && featuresPosition === "bottom" && (
            <div className="grid gap-8 sm:grid-cols-3 pb-4">
              {features.map(({ icon: Icon, title: featTitle, description: featDesc }) => (
                <div key={featTitle}>
                  <Icon className="mb-2 h-5 w-5 text-gold" />
                  <p className="text-sm font-semibold text-foreground">{featTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{featDesc}</p>
                </div>
              ))}
            </div>
          )}

          {stats && stats.length > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-4 rounded-2xl border border-border/60 bg-white/90 p-6 shadow-card">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center">
                  {Icon && <Icon className="mx-auto mb-2 h-5 w-5 text-gold" />}
                  <p className="text-2xl font-bold text-gold">{value}</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}

          {legacyCard && (
            <div className="mt-6 rounded-2xl border border-border/60 bg-white/95 p-6 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-gold" />
                <p className="font-semibold text-foreground">{legacyCard.title}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{legacyCard.body}</p>
            </div>
          )}
        </aside>

        {/* Form panel */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="mb-6 w-full max-w-md lg:hidden">
            <BrandHeader title={title} portalLabel={portalLabel} compact />
          </div>
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-white p-6 shadow-card sm:p-8">
            {(formCardTitle || formCardSubtitle) && (
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-light">
                  <FormCardIcon className="h-6 w-6 text-gold" />
                </div>
                {formCardTitle && <h2 className="font-serif text-2xl font-semibold text-navy">{formCardTitle}</h2>}
                {formCardSubtitle && <p className="mt-1 text-sm text-muted-foreground">{formCardSubtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
