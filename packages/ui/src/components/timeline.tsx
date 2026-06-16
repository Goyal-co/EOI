"use client";

import { cn } from "../lib/utils";
import { Check, Circle, Clock } from "lucide-react";

export interface TimelineStep {
  id: string;
  title: string;
  description?: string;
  status: "completed" | "current" | "upcoming";
  date?: string;
  remarks?: string;
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <div key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  step.status === "completed" && "border-success bg-success text-white",
                  step.status === "current" && "border-gold bg-gold-light text-gold",
                  step.status === "upcoming" && "border-border bg-surface text-muted-foreground"
                )}
              >
                {step.status === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : step.status === "current" ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[40px]",
                    step.status === "completed" ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </div>
            <div className={cn("pb-6", isLast && "pb-0")}>
              <p className={cn(
                "text-sm font-medium",
                step.status === "current" ? "text-gold" : "text-foreground"
              )}>
                {step.title}
              </p>
              {step.description && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
              {step.date && <p className="text-xs text-muted-foreground mt-1">{step.date}</p>}
              {step.remarks && (
                <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Remarks: </span>{step.remarks}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
