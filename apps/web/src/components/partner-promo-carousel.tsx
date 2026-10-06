"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PartnerPromoSlide = {
  id: string;
  title: string;
  mediaUrl: string;
  mediaKind: "IMAGE" | "GIF" | "VIDEO";
  linkUrl: string | null;
};

const AUTO_ADVANCE_MS = 5000;

export function PartnerPromoCarousel() {
  const [slides, setSlides] = useState<PartnerPromoSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner/promotions")
      .then((r) => {
        if (!r.ok) throw new Error("promotions");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSlides(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const count = slides.length;
  const go = useCallback(
    (dir: -1 | 1) => {
      if (count <= 1) return;
      setIndex((i) => (i + dir + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [count, go, index]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  if (!loaded || count === 0) return null;

  const slide = slides[index];
  if (!slide) return null;

  const media =
    slide.mediaKind === "VIDEO" ? (
      <video
        key={slide.id}
        src={slide.mediaUrl}
        className="h-full w-full object-cover"
        muted
        autoPlay
        loop
        playsInline
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={slide.id}
        src={slide.mediaUrl}
        alt={slide.title}
        className="h-full w-full object-cover"
      />
    );

  const content = slide.linkUrl ? (
    <a
      href={slide.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full w-full"
      aria-label={slide.title}
    >
      {media}
    </a>
  ) : (
    media
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted aspect-[4/1]">
      {content}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous promotion"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next promotion"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full ${
                  i === index ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
