"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  CardSkeleton,
  EmptyState,
  Modal,
} from "@goyal/ui";
import {
  BookOpen,
  Clock3,
  Play,
  Users,
  Video,
} from "lucide-react";

interface GuideVideo {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationLabel: string | null;
  featured: boolean;
  sortOrder: number;
}

function PlayOverlay({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const icon = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-white/70`}
    >
      <Play className={`${icon} fill-current ml-0.5`} />
    </span>
  );
}

function DurationBadge({ label }: { label?: string | null }) {
  if (!label) return null;
  return (
    <span className="absolute bottom-2 right-2 rounded bg-navy/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
      {label}
    </span>
  );
}

export default function PartnerPortalGuidePage() {
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<GuideVideo | null>(null);
  const [guides, setGuides] = useState<GuideVideo[]>([]);
  const [playing, setPlaying] = useState<GuideVideo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/partner/portal-guide");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load guides");
        if (cancelled) return;
        setFeatured(data.featured ?? null);
        setGuides(Array.isArray(data.guides) ? data.guides : []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasContent = Boolean(featured) || guides.length > 0;

  const featuredBullets = useMemo(
    () => [
      {
        icon: BookOpen,
        title: "Step-by-step guidance",
        body: "Explore all key features.",
      },
      {
        icon: Clock3,
        title: "Save time",
        body: "Get started quickly.",
      },
      {
        icon: Users,
        title: "Work more efficiently",
        body: "Maximize your partnership.",
      },
    ],
    [],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portal Guide"
        description="Learn how to use your Partner Portal"
      />

      {loading ? (
        <div className="space-y-6">
          <CardSkeleton />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : error ? (
        <EmptyState title="Unable to load guides" description={error} />
      ) : !hasContent ? (
        <EmptyState
          title="Guides coming soon"
          description="Your admin will publish walkthrough videos here."
        />
      ) : (
        <>
          {featured ? (
            <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50 shadow-card">
              <div className="grid gap-0 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPlaying(featured)}
                  className="group relative aspect-video w-full overflow-hidden bg-navy/5 lg:aspect-auto lg:min-h-[280px]"
                >
                  {featured.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featured.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center bg-gradient-to-br from-blue-100 to-blue-50">
                      <Video className="h-16 w-16 text-blue-400" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-navy/10 transition group-hover:bg-navy/20">
                    <PlayOverlay size="lg" />
                  </span>
                  <DurationBadge label={featured.durationLabel} />
                </button>

                <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                    <Video className="h-3.5 w-3.5" />
                    Featured video
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-navy">
                      {featured.title}
                    </h2>
                    {featured.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        {featured.description}
                      </p>
                    ) : null}
                  </div>
                  <ul className="space-y-3">
                    {featuredBullets.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.title} className="flex gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-navy">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted">{item.body}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setPlaying(featured)}
                    className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch walkthrough
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-navy">Quick Guides</h3>
              <p className="text-sm text-muted">
                Short videos for specific tasks.
              </p>
            </div>

            {guides.length === 0 ? (
              <p className="text-sm text-muted">
                More short guides will appear here once published.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {guides.map((guide) => (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => setPlaying(guide)}
                    className="group overflow-hidden rounded-xl border border-border bg-surface text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <div className="relative aspect-video overflow-hidden bg-blue-50">
                      {guide.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={guide.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Video className="h-10 w-10 text-blue-300" />
                        </div>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-navy/5 transition group-hover:bg-navy/15">
                        <PlayOverlay size="sm" />
                      </span>
                      <DurationBadge label={guide.durationLabel} />
                    </div>
                    <div className="space-y-1 p-4">
                      <h4 className="text-sm font-semibold text-navy group-hover:text-blue-700">
                        {guide.title}
                      </h4>
                      {guide.description ? (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                          {guide.description}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        open={Boolean(playing)}
        onOpenChange={(open) => {
          if (!open) setPlaying(null);
        }}
        title={playing?.title || "Guide video"}
        description={playing?.description || undefined}
        className="sm:max-w-3xl"
      >
        {playing ? (
          <video
            key={playing.id}
            src={playing.videoUrl}
            controls
            autoPlay
            className="mt-1 aspect-video w-full rounded-lg bg-black"
          />
        ) : null}
      </Modal>
    </div>
  );
}
