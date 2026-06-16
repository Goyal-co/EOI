"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";
import { Portal } from "./portal";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "right",
  className,
}: DrawerProps) {
  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[200]" role="presentation">
        <div
          className="absolute inset-0 bg-navy/60 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "absolute inset-y-0 flex w-full max-w-lg flex-col bg-surface shadow-modal outline-none",
            "animate-in duration-300",
            side === "right"
              ? "right-0 slide-in-from-right"
              : "left-0 slide-in-from-left",
            className
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
            <div className="min-w-0">
              {title && <h2 className="text-section-title leading-tight">{title}</h2>}
              {description && <p className="mt-1.5 text-caption">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {children}
          </div>

          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 bg-blue-50/40 px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
