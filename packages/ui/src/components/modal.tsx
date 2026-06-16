"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-navy/60 backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
          <Dialog.Content
            className={cn(
              "pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-modal outline-none",
              "max-h-[min(90vh,820px)]",
              sizeClasses[size],
              className
            )}
          >
            {(title || description) && (
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
                <div className="min-w-0 pr-2">
                  {title && (
                    <Dialog.Title className="text-section-title leading-tight">{title}</Dialog.Title>
                  )}
                  {description && (
                    <Dialog.Description className="mt-1.5 text-caption leading-relaxed">
                      {description}
                    </Dialog.Description>
                  )}
                </div>
                <Dialog.Close
                  aria-label="Close dialog"
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/20"
                >
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>
            )}

            {!title && !description && (
              <Dialog.Close
                aria-label="Close dialog"
                className="absolute right-4 top-4 z-10 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              {children}
            </div>

            {footer && (
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 bg-blue-50/40 px-6 py-4">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
