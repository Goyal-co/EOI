"use client";

import { cn } from "../lib/utils";
import { Check } from "lucide-react";
import { Button } from "./button";

export interface FormStep {
  id: string;
  title: string;
  description?: string;
}

export interface MultiStepFormProps {
  steps: FormStep[];
  currentStep: number;
  children: React.ReactNode;
  onPrevious?: () => void;
  onNext?: () => void;
  onSaveDraft?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  isLastStep?: boolean;
  loading?: boolean;
  canProceed?: boolean;
}

export function MultiStepForm({
  steps,
  currentStep,
  children,
  onPrevious,
  onNext,
  onSaveDraft,
  nextLabel = "Continue",
  previousLabel = "Previous",
  isLastStep,
  loading,
  canProceed = true,
}: MultiStepFormProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex min-w-max items-center justify-between gap-2 px-1">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex w-20 sm:w-24 flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all shrink-0",
                      isCompleted && "bg-success text-white",
                      isCurrent && "bg-gold text-white ring-4 ring-gold-light",
                      !isCompleted && !isCurrent && "bg-border text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <p className={cn(
                    "text-xs mt-1.5 text-center line-clamp-2",
                    isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "h-0.5 w-8 sm:w-12 mx-1 sm:mx-2 shrink-0",
                    isCompleted ? "bg-success" : "bg-border"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-section-title mb-1">{steps[currentStep]?.title}</h2>
        {steps[currentStep]?.description && (
          <p className="text-caption mb-6">{steps[currentStep].description}</p>
        )}
        {children}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          {onPrevious && currentStep > 0 && (
            <Button variant="outline" onClick={onPrevious}>{previousLabel}</Button>
          )}
        </div>
        <div className="flex gap-3">
          {onSaveDraft && (
            <Button variant="ghost" onClick={onSaveDraft}>Save Draft</Button>
          )}
          {onNext && (
            <Button
              variant={isLastStep ? "gold" : "default"}
              onClick={onNext}
              loading={loading}
              disabled={!canProceed}
            >
              {isLastStep ? (nextLabel || "Submit") : nextLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
