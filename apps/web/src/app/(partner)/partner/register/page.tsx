"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Input, MultiStepForm, useToast, AuthLayout,
} from "@goyal/ui";
import type { CPRegisterStep1, CPRegisterStep2 } from "@goyal/types";
import { isRegistrationStepValid, getRegistrationStepHints } from "@/lib/registration/validation";

const STEPS = [
  { id: "personal", title: "Personal", description: "Your personal account details" },
  { id: "business", title: "Business", description: "RERA, PAN, and GST details" },
];

export default function PartnerRegisterPage() {
  const [step, setStep] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(false);
  const [step1, setStep1] = useState<CPRegisterStep1>({
    fullName: "",
    mobile: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [step2, setStep2] = useState<CPRegisterStep2>({
    companyName: "",
    reraNumber: "",
    panNumber: "",
    gstNumber: "",
  });
  const { addToast } = useToast();
  const router = useRouter();

  const postStep = async (s: number, data: unknown) => {
    const res = await fetch("/api/partner/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: s, data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Validation failed");
    return json;
  };

  const canProceed = isRegistrationStepValid(step, step1, step2);
  const hints = useMemo(() => getRegistrationStepHints(step, step1, step2), [step, step1, step2]);

  const handleNext = async () => {
    setLoading(true);
    try {
      if (step === 0) {
        const result = await postStep(1, step1);
        if (result.notice) {
          addToast({ type: "info", title: "Note", message: result.notice });
        }
        setStep(1);
      } else {
        await postStep(3, { step1, step2 });
        addToast({ type: "success", title: "Registration submitted", message: "Your account is pending admin approval" });
        router.push(`/partner/pending-approval?email=${encodeURIComponent(step1.email)}`);
      }
    } catch (err) {
      addToast({ type: "error", title: "Error", message: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      portalLabel="Partner Portal"
      subtitle="Join our network of channel partners"
    >
      <h1 className="text-page-title">Partner Registration</h1>
      <p className="text-caption mt-1 mb-6">Complete your application to get started</p>

      <MultiStepForm
        steps={STEPS}
        currentStep={step}
        isLastStep={step === 1}
        loading={loading}
        canProceed={canProceed}
        onPrevious={step > 0 ? () => setStep(0) : undefined}
        onNext={handleNext}
        nextLabel={step === 1 ? "Submit Registration" : "Continue"}
      >
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name" value={step1.fullName} onChange={(e) => setStep1({ ...step1, fullName: e.target.value })} className="sm:col-span-2" />
            <Input
              label="Mobile"
              value={step1.mobile}
              onChange={(e) => setStep1({ ...step1, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              placeholder="10-digit number"
            />
            <Input label="Email" type="email" value={step1.email} onChange={(e) => setStep1({ ...step1, email: e.target.value })} />
            <Input label="Password" type="password" value={step1.password} onChange={(e) => setStep1({ ...step1, password: e.target.value })} />
            <Input label="Confirm Password" type="password" value={step1.confirmPassword} onChange={(e) => setStep1({ ...step1, confirmPassword: e.target.value })} />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Company Name (optional)"
              value={step2.companyName || ""}
              onChange={(e) => setStep2({ ...step2, companyName: e.target.value })}
              className="sm:col-span-2"
            />
            <Input
              label="RERA Number"
              value={step2.reraNumber}
              onChange={(e) => setStep2({ ...step2, reraNumber: e.target.value })}
              placeholder="Min 5 characters"
            />
            <Input
              label="PAN Number"
              value={step2.panNumber}
              onChange={(e) => setStep2({ ...step2, panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })}
              placeholder="ABCDE1234F"
            />
            <Input
              label="GST Number (optional)"
              value={step2.gstNumber || ""}
              onChange={(e) => setStep2({ ...step2, gstNumber: e.target.value })}
              className="sm:col-span-2"
            />
          </div>
        )}

        {!canProceed && hints.length > 0 && (
          <ul className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1 list-disc list-inside">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}
      </MultiStepForm>

      <p className="text-center text-sm text-muted-foreground mt-8">
        Already have an account?{" "}
        <Link href="/partner/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
