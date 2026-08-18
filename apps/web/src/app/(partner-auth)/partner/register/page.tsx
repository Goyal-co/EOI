"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Input, MultiStepForm, useToast, AuthLayout, FileUpload, type UploadedFile,
} from "@goyal/ui";
import type { CPRegisterStep1, CPRegisterStep2 } from "@goyal/types";
import { isRegistrationStepValid, getRegistrationStepHints } from "@/lib/registration/validation";

const STEPS = [
  { id: "personal", title: "Personal", description: "Your personal account details" },
  { id: "business", title: "Business", description: "Company, RERA, PAN, GST & documents" },
];

type DocKey = "reraCert" | "gstCert" | "cheque" | "panDoc";

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
  const [docs, setDocs] = useState<Partial<Record<DocKey, File>>>({});
  const [docMeta, setDocMeta] = useState<Partial<Record<DocKey, UploadedFile>>>({});
  const { addToast } = useToast();
  const router = useRouter();

  const setDoc = (key: DocKey, file: File | null) => {
    setDocs((prev) => {
      const next = { ...prev };
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
    setDocMeta((prev) => {
      const next = { ...prev };
      if (file) next[key] = { name: file.name, size: file.size, status: "success" };
      else delete next[key];
      return next;
    });
  };

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

  const docsValid = !!docs.reraCert && !!docs.panDoc && !!docs.cheque;
  const canProceed = step === 0
    ? isRegistrationStepValid(0, step1, step2)
    : isRegistrationStepValid(1, step1, step2) && docsValid;
  const hints = useMemo(() => {
    const base = getRegistrationStepHints(step, step1, step2);
    if (step === 1) {
      if (!docs.reraCert) base.push("Upload RERA certificate PDF");
      if (!docs.panDoc) base.push("Upload PAN document PDF");
      if (!docs.cheque) base.push("Upload cancelled cheque image");
    }
    return base;
  }, [step, step1, step2, docs]);

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
        const form = new FormData();
        form.append("step", "3");
        form.append("step1", JSON.stringify(step1));
        form.append("step2", JSON.stringify(step2));
        form.append("reraCert", docs.reraCert!);
        form.append("panDoc", docs.panDoc!);
        form.append("cheque", docs.cheque!);
        if (docs.gstCert) form.append("gstCert", docs.gstCert);

        const res = await fetch("/api/partner/register", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Registration failed");

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
      subtitle="Join our network of property advisor"
      description=""
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
              label="Company / Individual Name"
              value={step2.companyName || ""}
              onChange={(e) => setStep2({ ...step2, companyName: e.target.value })}
              className="sm:col-span-2"
              placeholder="Registered company or individual name"
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
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <FileUpload
                label="RERA Certificate (PDF)"
                accept=".pdf,application/pdf"
                maxSize={10 * 1024 * 1024}
                file={docMeta.reraCert || null}
                onUpload={(file) => setDoc("reraCert", file)}
                onRemove={() => setDoc("reraCert", null)}
              />
              <FileUpload
                label="PAN Document (PDF)"
                accept=".pdf,application/pdf"
                maxSize={10 * 1024 * 1024}
                file={docMeta.panDoc || null}
                onUpload={(file) => setDoc("panDoc", file)}
                onRemove={() => setDoc("panDoc", null)}
              />
              <FileUpload
                label="Cancelled Cheque (Image)"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                maxSize={10 * 1024 * 1024}
                file={docMeta.cheque || null}
                onUpload={(file) => setDoc("cheque", file)}
                onRemove={() => setDoc("cheque", null)}
              />
              <FileUpload
                label="GST Certificate (PDF, optional)"
                accept=".pdf,application/pdf"
                maxSize={10 * 1024 * 1024}
                file={docMeta.gstCert || null}
                onUpload={(file) => setDoc("gstCert", file)}
                onRemove={() => setDoc("gstCert", null)}
              />
            </div>
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
        <Link href="/partner/login" className="text-blue-600 font-medium hover:underline">Log In</Link>
      </p>
    </AuthLayout>
  );
}
