"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  MultiStepForm, Input, Select, Textarea, LoadingSkeleton, EmptyState, PageHeader, useToast,
} from "@goyal/ui";
import { useCustomerEOI, useCustomerDocuments } from "@/lib/hooks";
import { customerPath, useCustomerEoiId } from "@/components/customer/project-switcher";
import { CustomerDocumentUploads, type CustomerDocumentRecord } from "@/components/customer/customer-document-uploads";
import {
  resolveRequiredDocumentTypes,
  formatMissingDocumentLabels,
  CUSTOMER_EOI_DOCUMENT_TYPES,
} from "@/lib/required-documents";
import type {
  EOIPersonalDetails, EOIAddress, EOIUnitPreference, EOIBankDetails,
} from "@goyal/types";

const STEPS = [
  { id: "personal", title: "Personal", description: "Your identity and contact details" },
  { id: "address", title: "Address", description: "Current address and occupation" },
  { id: "unitPreference", title: "Unit Preference", description: "Preferred configuration and budget" },
  { id: "bankDetails", title: "Bank Details", description: "EOI cheque information" },
  { id: "documents", title: "Documents", description: "Upload PAN, Aadhaar, and EOI cheque" },
  { id: "review", title: "Review", description: "Review and submit your EOI" },
];

const STEP_KEYS = ["personal", "address", "unitPreference", "bankDetails"] as const;
const DOCUMENTS_STEP = 4;
const REVIEW_STEP = 5;

type FormData = {
  personal: Partial<EOIPersonalDetails>;
  address: Partial<EOIAddress>;
  unitPreference: Partial<EOIUnitPreference>;
  bankDetails: Partial<EOIBankDetails>;
};

const EMPTY_FORM: FormData = {
  personal: {},
  address: {},
  unitPreference: {},
  bankDetails: {},
};

function CustomerEOIContent() {
  const router = useRouter();
  const { addToast } = useToast();
  const eoiId = useCustomerEoiId();
  const { data: eoi, isLoading } = useCustomerEOI(eoiId);
  const { data: documentsData } = useCustomerDocuments(eoiId);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const documents = (documentsData || eoi?.documents || []) as CustomerDocumentRecord[];

  const requiredDocTypes = useMemo(() => {
    const rule = (eoi?.project as { eoiRules?: { requiredDocuments?: string[] }[] } | undefined)
      ?.eoiRules?.[0];
    if (rule?.requiredDocuments?.length) {
      const resolved = resolveRequiredDocumentTypes(rule.requiredDocuments);
      if (resolved.length > 0) return resolved;
    }
    return [...CUSTOMER_EOI_DOCUMENT_TYPES];
  }, [eoi]);

  useEffect(() => {
    if (eoi?.formData) {
      const saved = eoi.formData as Record<string, unknown>;
      setFormData({
        personal: (saved.personal as FormData["personal"]) || {},
        address: (saved.address as FormData["address"]) || {},
        unitPreference: (saved.unitPreference as FormData["unitPreference"]) || {},
        bankDetails: (saved.bankDetails as FormData["bankDetails"]) || {},
      });
    }
    const lead = eoi?.lead;
    if (lead) {
      setFormData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          fullName: prev.personal.fullName || lead.customerName,
          email: prev.personal.email || lead.customerEmail,
          mobile: prev.personal.mobile || lead.customerMobile,
        },
        unitPreference: {
          ...prev.unitPreference,
          preferredConfiguration: prev.unitPreference.preferredConfiguration || lead.configuration || "",
          budgetRange: prev.unitPreference.budgetRange || lead.budget || "",
        },
        address: {
          ...prev.address,
          city: prev.address.city || lead.city || "",
        },
      }));
    }
  }, [eoi]);

  const updateField = <K extends keyof FormData>(
    step: K,
    field: keyof FormData[K],
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [step]: { ...prev[step], [field]: value },
    }));
  };

  const getMissingRequiredDocs = () => {
    const uploaded = new Set(documents.map((d) => d.type));
    return requiredDocTypes.filter((t) => !uploaded.has(t));
  };

  const saveStep = async (submit = false) => {
    setSaving(true);
    const stepKey = currentStep < 4 ? STEP_KEYS[currentStep] : "bankDetails";
    const data = currentStep < 4 ? formData[STEP_KEYS[currentStep]] : formData.bankDetails;

    const eoiQuery = eoiId ? `?eoiId=${encodeURIComponent(eoiId)}` : "";
    const res = await fetch(`/api/customer/eoi${eoiQuery}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: submit ? "bankDetails" : stepKey,
        data,
        submit,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const err = await res.json();
      addToast({ type: "error", title: "Save failed", message: err.error || "Failed to save" });
      return false;
    }

    if (submit) {
      router.push(customerPath("/customer/eoi/success", eoiId));
      return true;
    }
    return true;
  };

  const handleNext = async () => {
    if (currentStep === DOCUMENTS_STEP) {
      const missing = getMissingRequiredDocs();
      if (missing.length > 0) {
        addToast({
          type: "error",
          title: "Documents required",
          message: `Please upload: ${formatMissingDocumentLabels(missing)}`,
        });
        return;
      }
      setCurrentStep(REVIEW_STEP);
      return;
    }

    if (currentStep === REVIEW_STEP) {
      const missing = getMissingRequiredDocs();
      if (missing.length > 0) {
        addToast({
          type: "error",
          title: "Documents required",
          message: `Please upload: ${formatMissingDocumentLabels(missing)}`,
        });
        setCurrentStep(DOCUMENTS_STEP);
        return;
      }
      await saveStep(true);
      return;
    }

    const ok = await saveStep(false);
    if (ok) setCurrentStep((s) => s + 1);
  };

  const handlePrevious = () => setCurrentStep((s) => Math.max(0, s - 1));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (!eoi) {
    return (
      <div className="space-y-6">
        <EmptyState title="No EOI Found" description="You need an active invitation to submit an EOI." />
      </div>
    );
  }

  const editable = ["PENDING_SUBMISSION", "DRAFT", "CORRECTION_REQUESTED"].includes(eoi.status);

  if (!editable) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="EOI Already Submitted"
          description="Your EOI has been submitted and is being processed. Track progress in My EOI."
          actionLabel="View My EOI"
          onAction={() => router.push(customerPath("/customer/my-eoi", eoiId))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expression of Interest"
        description={`${eoi.project?.name} — Complete all steps to submit`}
      />

      <MultiStepForm
        steps={STEPS}
        currentStep={currentStep}
        onNext={handleNext}
        onPrevious={currentStep > 0 ? handlePrevious : undefined}
        onSaveDraft={() => (currentStep <= 3 ? saveStep(false) : undefined)}
        isLastStep={currentStep === REVIEW_STEP}
        loading={saving}
      >
        {currentStep === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" value={formData.personal.fullName || ""} onChange={(e) => updateField("personal", "fullName", e.target.value)} required />
            <Input label="Date of Birth" type="date" value={formData.personal.dob || ""} onChange={(e) => updateField("personal", "dob", e.target.value)} required />
            <Select label="Gender" value={formData.personal.gender || ""} onChange={(e) => updateField("personal", "gender", e.target.value)} options={[
              { value: "", label: "Select gender" },
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
              { value: "OTHER", label: "Other" },
            ]} />
            <Input label="Mobile" value={formData.personal.mobile || ""} onChange={(e) => updateField("personal", "mobile", e.target.value)} required />
            <Input label="Email" type="email" value={formData.personal.email || ""} onChange={(e) => updateField("personal", "email", e.target.value)} required />
            <Input label="PAN Number" value={formData.personal.panNumber || ""} onChange={(e) => updateField("personal", "panNumber", e.target.value.toUpperCase())} placeholder="ABCDE1234F" required />
            <Input label="Aadhaar Number" value={formData.personal.aadhaarNumber || ""} onChange={(e) => updateField("personal", "aadhaarNumber", e.target.value)} maxLength={12} required />
          </div>
        )}

        {currentStep === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Textarea label="Current Address" value={formData.address.currentAddress || ""} onChange={(e) => updateField("address", "currentAddress", e.target.value)} required />
            </div>
            <Input label="City" value={formData.address.city || ""} onChange={(e) => updateField("address", "city", e.target.value)} required />
            <Input label="State" value={formData.address.state || ""} onChange={(e) => updateField("address", "state", e.target.value)} required />
            <Input label="Pincode" value={formData.address.pincode || ""} onChange={(e) => updateField("address", "pincode", e.target.value)} maxLength={6} required />
            <Input label="Occupation" value={formData.address.occupation || ""} onChange={(e) => updateField("address", "occupation", e.target.value)} required />
            <Input label="Company Name" value={formData.address.companyName || ""} onChange={(e) => updateField("address", "companyName", e.target.value)} />
            <Input label="Annual Income" value={formData.address.annualIncome || ""} onChange={(e) => updateField("address", "annualIncome", e.target.value)} required />
          </div>
        )}

        {currentStep === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Preferred Configuration" value={formData.unitPreference.preferredConfiguration || ""} onChange={(e) => updateField("unitPreference", "preferredConfiguration", e.target.value)} options={[
              { value: "", label: "Select configuration" },
              { value: "1 BHK", label: "1 BHK" },
              { value: "2 BHK", label: "2 BHK" },
              { value: "3 BHK", label: "3 BHK" },
              { value: "4 BHK", label: "4 BHK" },
              { value: "Penthouse", label: "Penthouse" },
            ]} />
            <Input label="Preferred Tower" value={formData.unitPreference.preferredTower || ""} onChange={(e) => updateField("unitPreference", "preferredTower", e.target.value)} />
            <Select label="Budget Range" value={formData.unitPreference.budgetRange || ""} onChange={(e) => updateField("unitPreference", "budgetRange", e.target.value)} options={[
              { value: "", label: "Select budget" },
              { value: "Below 1 Cr", label: "Below ₹1 Cr" },
              { value: "1-2 Cr", label: "₹1–2 Cr" },
              { value: "2-3 Cr", label: "₹2–3 Cr" },
              { value: "3-5 Cr", label: "₹3–5 Cr" },
              { value: "Above 5 Cr", label: "Above ₹5 Cr" },
            ]} />
            <div className="sm:col-span-2">
              <Textarea label="Additional Notes" value={formData.unitPreference.additionalNotes || ""} onChange={(e) => updateField("unitPreference", "additionalNotes", e.target.value)} />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Bank Name" value={formData.bankDetails.bankName || ""} onChange={(e) => updateField("bankDetails", "bankName", e.target.value)} required />
            <Input label="Account Holder Name" value={formData.bankDetails.accountHolderName || ""} onChange={(e) => updateField("bankDetails", "accountHolderName", e.target.value)} required />
            <Input label="Cheque Number" value={formData.bankDetails.chequeNumber || ""} onChange={(e) => updateField("bankDetails", "chequeNumber", e.target.value)} required />
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Upload your cancelled cheque image in the next step.
            </p>
          </div>
        )}

        {currentStep === DOCUMENTS_STEP && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload all required documents now. You can replace them later from the Documents section if your EOI needs corrections.
            </p>
            <CustomerDocumentUploads
              eoiId={eoiId}
              documents={documents}
              requiredTypes={requiredDocTypes}
              compact
            />
          </div>
        )}

        {currentStep === REVIEW_STEP && (
          <div className="space-y-6 text-sm">
            {(["personal", "address", "unitPreference", "bankDetails"] as const).map((section) => (
              <div key={section}>
                <h3 className="font-semibold text-foreground capitalize mb-2">
                  {section === "unitPreference" ? "Unit Preference" : section === "bankDetails" ? "Bank Details" : section}
                </h3>
                <div className="rounded-lg bg-blue-50 p-4 grid grid-cols-2 gap-2">
                  {Object.entries(formData[section]).map(([key, value]) => (
                    value ? (
                      <div key={key}>
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                        <span className="text-foreground">{String(value)}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>
            ))}
            <div>
              <h3 className="font-semibold text-foreground mb-2">Documents</h3>
              <div className="rounded-lg bg-blue-50 p-4 space-y-1">
                {requiredDocTypes.map((type) => {
                  const doc = documents.find((d) => d.type === type);
                  return (
                    <p key={type} className={doc ? "text-foreground" : "text-red-600"}>
                      {doc ? "✓" : "✗"} {type === "PAN" ? "PAN Card" : type === "AADHAAR" ? "Aadhaar Card" : "EOI Cheque"}
                      {doc ? ` — ${doc.fileName}` : " — not uploaded"}
                    </p>
                  );
                })}
              </div>
            </div>
            <p className="text-muted-foreground">
              By submitting, you confirm all details and documents are accurate.
            </p>
          </div>
        )}
      </MultiStepForm>
    </div>
  );
}

export default function CustomerEOIPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={5} />}>
      <CustomerEOIContent />
    </Suspense>
  );
}
