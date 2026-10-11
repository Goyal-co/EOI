"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Modal, Button, Input, Select, Textarea, MultiStepForm, FileUpload, useToast,
} from "@goyal/ui";
import { CheckCircle, Clock, Layers3 } from "lucide-react";
import type { LeadCreateInput } from "@goyal/types";
import { ProjectUnitBudgetFields } from "@/components/project-unit-budget-fields";
import { usePartnerProjects } from "@/lib/hooks";
import { uploadViaPresign } from "@/lib/uploads/client-upload";

const CUSTOMER_STEPS = [
  { id: "customer", title: "Customer Details", description: "Enter customer information for the EOI" },
  { id: "review", title: "Review", description: "Verify details before submitting" },
  { id: "success", title: "Success", description: "Customer saved" },
];

const CP_STEPS = [
  { id: "customer", title: "Customer Details", description: "Enter customer information for the EOI" },
  { id: "documents", title: "Documents", description: "Upload EOI document and cancelled cheque" },
  { id: "review", title: "Review", description: "Verify details before submitting" },
  { id: "success", title: "Success", description: "EOI submitted" },
];

type UploadedDoc = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type AvailableProject = {
  id: string;
  name: string;
  location: string;
  eoiStatus: string;
  action: "EOI" | "LEAD_ONLY";
};

interface SubmitEOIModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  /** When known from parent, avoids racing slim projects fetch */
  eoiFormFiller?: "CUSTOMER" | "CP" | null;
  initialLead?: Pick<
    LeadCreateInput,
    "customerName" | "mobile" | "email" | "configuration" | "fosName" | "budget" | "city" | "notes"
  >;
  onMapToProject?: (
    project: AvailableProject,
    lead: Pick<
      LeadCreateInput,
      "customerName" | "mobile" | "email" | "configuration" | "fosName" | "budget" | "city" | "notes"
    >,
  ) => void;
}

function formatLockCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) return "—";
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  if (remaining === 0) return "Unlocked";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SubmitEOIModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  eoiFormFiller: eoiFormFillerProp,
  initialLead,
  onMapToProject,
}: SubmitEOIModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const [devLinks, setDevLinks] = useState<{ acceptUrl: string; rejectUrl: string } | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [duplicateMapProjectId, setDuplicateMapProjectId] = useState("");
  const [showDuplicateMap, setShowDuplicateMap] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(projectId);
  const [activeProjectName, setActiveProjectName] = useState(projectName);
  const [now, setNow] = useState(Date.now());
  const [confirmationFlowEnabled, setConfirmationFlowEnabled] = useState<boolean | null>(null);
  const [cpEoiSubmitted, setCpEoiSubmitted] = useState(false);
  const [eoiDocument, setEoiDocument] = useState<UploadedDoc | null>(null);
  const [chequeDocument, setChequeDocument] = useState<UploadedDoc | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<"EOI_DOCUMENT" | "CHEQUE" | null>(null);
  const [form, setForm] = useState<LeadCreateInput>({
    customerName: "",
    mobile: "",
    email: "",
    projectId,
    configuration: "",
    fosName: "",
    budget: "",
    city: "",
    notes: "",
  });
  const { addToast } = useToast();
  const qc = useQueryClient();
  const { data: slimProjects, isLoading: slimLoading } = usePartnerProjects({ slim: true });
  const activeProject = useMemo(
    () => slimProjects?.find((p) => p.id === activeProjectId),
    [slimProjects, activeProjectId],
  );
  const resolvedFiller =
    eoiFormFillerProp
    ?? activeProject?.eoiFormFiller
    ?? (slimLoading || !slimProjects ? null : "CUSTOMER");
  const fillerReady = resolvedFiller !== null;
  const isCpFilled = resolvedFiller === "CP";
  const steps = isCpFilled ? CP_STEPS : CUSTOMER_STEPS;
  const successStep = isCpFilled ? 3 : 2;
  const reviewStep = isCpFilled ? 2 : 1;
  const activeUnitPreferences = useMemo(() => {
    if (!activeProject) return undefined;
    return activeProject.unitPreferences ?? null;
  }, [activeProject]);

  useEffect(() => {
    if (!open) return;
    setActiveProjectId(projectId);
    setActiveProjectName(projectName);
  }, [open, projectId, projectName]);

  useEffect(() => {
    if (!open || isCpFilled) return;
    setConfirmationFlowEnabled(null);
    fetch("/api/partner/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("settings"))))
      .then((data) => {
        setConfirmationFlowEnabled(data.permissions?.cpConfirmationFlowEnabled !== false);
      })
      .catch(() => {
        setConfirmationFlowEnabled(false);
      });
  }, [open, isCpFilled]);

  useEffect(() => {
    if (!open || !initialLead) return;
    setForm((current) => ({
      ...current,
      ...initialLead,
      projectId: activeProjectId,
      intentType: "EOI",
    }));
  }, [initialLead, open, activeProjectId]);

  useEffect(() => {
    if (!lockExpiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [lockExpiresAt]);

  const reset = () => {
    setStep(0);
    setSentConfirmation(false);
    setCpEoiSubmitted(false);
    setEoiDocument(null);
    setChequeDocument(null);
    setUploadingDoc(null);
    setDevLinks(null);
    setEmailWarning(null);
    setCreatedLeadId(null);
    setLockExpiresAt(null);
    setAvailableProjects([]);
    setDuplicateMapProjectId("");
    setShowDuplicateMap(false);
    setActiveProjectId(projectId);
    setActiveProjectName(projectName);
    setForm({
      customerName: "",
      mobile: "",
      email: "",
      projectId,
      configuration: "",
      fosName: "",
      budget: "",
      city: "",
      notes: "",
      intentType: "EOI",
      ...initialLead,
    });
  };

  const handleClose = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const canProceed =
    step === 0
      ? form.customerName.length >= 2
        && /^[6-9]\d{9}$/.test(form.mobile)
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
        && (form.configuration?.length ?? 0) >= 1
        && (form.fosName?.length ?? 0) >= 1
      : isCpFilled && step === 1
        ? Boolean(eoiDocument && chequeDocument)
        : true;

  const uploadCpDoc = async (kind: "EOI_DOCUMENT" | "CHEQUE", file: File) => {
    setUploadingDoc(kind);
    try {
      const uploaded = await uploadViaPresign(file, kind === "CHEQUE" ? "CHEQUE" : "EOI_DOCUMENT");
      const doc: UploadedDoc = {
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
      };
      if (kind === "EOI_DOCUMENT") setEoiDocument(doc);
      else setChequeDocument(doc);
      addToast({ type: "success", title: kind === "EOI_DOCUMENT" ? "EOI document uploaded" : "Cheque uploaded" });
    } catch (e) {
      addToast({
        type: "error",
        title: "Upload failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const selectedMapProject = useMemo(
    () => availableProjects.find((p) => p.id === duplicateMapProjectId) || null,
    [availableProjects, duplicateMapProjectId],
  );

  const handleMapProject = () => {
    if (!selectedMapProject) return;
    const seed = {
      customerName: form.customerName,
      mobile: form.mobile,
      email: form.email,
      configuration: form.configuration,
      fosName: form.fosName,
      budget: form.budget,
      city: form.city,
      notes: form.notes,
    };
    if (selectedMapProject.action === "LEAD_ONLY") {
      if (onMapToProject) {
        onMapToProject(selectedMapProject, seed);
        handleClose(false);
        return;
      }
      handleClose(false);
      router.push("/partner/leads");
      addToast({
        type: "info",
        title: "Open My Leads",
        message: "Select this customer and use Map to another project to punch a lead.",
      });
      return;
    }
    setActiveProjectId(selectedMapProject.id);
    setActiveProjectName(selectedMapProject.name);
    setForm((current) => ({ ...current, projectId: selectedMapProject.id }));
    setShowDuplicateMap(false);
    setDuplicateMapProjectId("");
    setStep(0);
    addToast({
      type: "info",
      title: "Project switched",
      message: `Continue EOI for ${selectedMapProject.name}.`,
    });
  };

  const handleSubmit = async (sendConfirmation: boolean) => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        projectId: activeProjectId,
        intentType: "EOI",
        sendConfirmation: isCpFilled ? false : sendConfirmation,
      };
      if (isCpFilled) {
        if (!eoiDocument || !chequeDocument) {
          addToast({ type: "error", title: "Documents required", message: "Upload EOI document and cancelled cheque" });
          setLoading(false);
          return;
        }
        Object.assign(payload, {
          submitAsCpEoi: true,
          eoiDocumentUrl: eoiDocument.fileUrl,
          eoiDocumentFileName: eoiDocument.fileName,
          eoiDocumentMimeType: eoiDocument.mimeType,
          eoiDocumentFileSize: eoiDocument.fileSize,
          chequeDocumentUrl: chequeDocument.fileUrl,
          chequeDocumentFileName: chequeDocument.fileName,
          chequeDocumentMimeType: chequeDocument.mimeType,
          chequeDocumentFileSize: chequeDocument.fileSize,
        });
      }
      const res = await fetch("/api/partner/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          res.status >= 500
            ? "Server error while submitting EOI. Please try again in a moment."
            : `Unexpected response (${res.status}). Please try again.`,
        );
      }
      if (!res.ok) {
        if (res.status === 409 && data.code === "DUPLICATE_LEAD") {
          setAvailableProjects((data.availableProjects as AvailableProject[]) || []);
          setLockExpiresAt((data.lockExpiresAt as string) || null);
          setShowDuplicateMap(true);
          addToast({
            type: "warning",
            title: "Already registered on this project",
            message: "Use the project dropdown below to map this customer to another project, or open My Leads.",
          });
          return;
        }
        if (res.status === 409 && data.code === "LEAD_ID_CONFLICT") {
          addToast({
            type: "error",
            title: "Please try again",
            message:
              (typeof data.error === "string" && data.error) ||
              "Temporary lead id conflict. Submit again — this is not a duplicate customer.",
          });
          return;
        }
        if (res.status === 409 && data.code === "IDENTITY_LOCKED") {
          addToast({
            type: "error",
            title: "Lead locked",
            message:
              (typeof data.error === "string" && data.error)
              || "Another channel partner currently holds this phone/email. Try again after their lock expires.",
          });
          return;
        }
        if (res.status === 409 && data.code === "PRIOR_CP_COOLDOWN") {
          addToast({
            type: "error",
            title: "Cooldown active",
            message:
              (typeof data.error === "string" && data.error)
              || "You previously owned this lead during a lock. Wait for the cooldown before submitting again.",
          });
          return;
        }
        throw new Error((data.error as string) || "Failed to submit");
      }

      setSentConfirmation(!!data.sentConfirmation);
      setCpEoiSubmitted(!!data.cpEoiSubmitted);
      setCreatedLeadId((data.lead as { leadId?: string } | undefined)?.leadId || null);
      setLockExpiresAt((data.lockExpiresAt as string) || null);
      setAvailableProjects((data.availableProjects as AvailableProject[]) || []);
      setDevLinks((data.devConfirmationLinks as { acceptUrl: string; rejectUrl: string } | null) || null);
      setEmailWarning(
        (data.emailError as string | undefined)
        || (data.emailMocked
          ? "Email was not sent — restart the server after adding BREVO_API_KEY to .env.local"
          : null)
      );
      setStep(successStep);
      void qc.invalidateQueries({ queryKey: ["partner", "leads"] });
      void qc.invalidateQueries({ queryKey: ["partner", "eois"] });
      void qc.invalidateQueries({ queryKey: ["partner", "analytics"] });
      if (isCpFilled || data.cpEoiSubmitted) {
        addToast({
          type: "success",
          title: "EOI submitted",
          message: "Documents sent for admin review.",
        });
      } else {
        addToast({
          type: data.sentConfirmation ? "success" : "warning",
          title: sendConfirmation
            ? data.sentConfirmation
              ? "Confirmation sent"
              : data.emailMocked
                ? "Lead saved — email not sent (mock mode)"
                : "Lead saved — email failed"
            : "Customer saved",
          message: data.sentConfirmation
            ? "Confirmation email sent to the customer via Brevo"
            : (typeof data.emailError === "string" && data.emailError
              ? data.emailError
              : (data.emailMocked
                ? "Restart the dev server so BREVO_API_KEY loads. Use the dev links below meanwhile."
                : "Lead saved but email could not be sent. Use the dev links below or resend from Leads.")),
        });
      }
    } catch (err) {
      addToast({ type: "error", title: "Submission failed", message: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={handleClose} title={`Submit EOI — ${activeProjectName}`} size="lg">
      {!fillerReady ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading project EOI settings…</p>
      ) : (
      <MultiStepForm
        steps={steps}
        currentStep={step}
        isLastStep={false}
        loading={loading}
        canProceed={canProceed && !showDuplicateMap}
        onPrevious={step > 0 && step < successStep ? () => setStep(step - 1) : undefined}
        onNext={
          step === 0 || (isCpFilled && step === 1)
            ? () => setStep(step + 1)
            : undefined
        }
        nextLabel="Continue"
      >
        {showDuplicateMap && (
          <div className="mb-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Layers3 className="h-4 w-4" />
              Customer already on this project
            </div>
            <p className="text-xs text-amber-800">
              Phone and email stay under your protection lock. Map this same customer to another project below.
            </p>
            {lockExpiresAt && (
              <p className="font-mono text-sm font-semibold text-amber-900">
                Lock: {formatLockCountdown(lockExpiresAt, now)}
              </p>
            )}
            {availableProjects.length ? (
              <>
                <Select
                  label="Add to another project"
                  value={duplicateMapProjectId}
                  onChange={(e) => setDuplicateMapProjectId(e.target.value)}
                  options={[
                    { value: "", label: "Select project…" },
                    ...availableProjects.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.action === "EOI" ? "EOI" : "Lead"})`,
                    })),
                  ]}
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { handleClose(false); router.push("/partner/leads"); }}>
                    Open My Leads
                  </Button>
                  <Button
                    variant="gold"
                    size="sm"
                    disabled={!selectedMapProject}
                    onClick={handleMapProject}
                  >
                    {selectedMapProject?.action === "EOI" ? "Register EOI" : "Punch Lead"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { handleClose(false); router.push("/partner/leads"); }}>
                  Open My Leads
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Customer Name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="Full name"
              className="sm:col-span-2"
            />
            <Input
              label="Mobile"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              placeholder="10-digit mobile"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="customer@email.com"
            />
            <Input
              label="FOS Name"
              value={form.fosName || ""}
              onChange={(e) => setForm({ ...form, fosName: e.target.value })}
              placeholder="Field officer name"
            />
            <ProjectUnitBudgetFields
              projectId={activeProjectId}
              configuration={form.configuration || ""}
              budget={form.budget || ""}
              onConfigurationChange={(configuration) =>
                setForm((current) => ({ ...current, configuration }))
              }
              onBudgetChange={(budget) =>
                setForm((current) => ({ ...current, budget }))
              }
              configurationRequired
              unitPreferences={activeUnitPreferences}
            />
            <Input
              label="City"
              value={form.city || ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Customer city (optional)"
            />
            <Textarea
              label="Notes"
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes (optional)"
              className="sm:col-span-2"
            />
          </div>
        )}

        {isCpFilled && step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a PDF or JPEG of the signed EOI form and a cancelled cheque. Admin will review after submit.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">EOI Document *</label>
              <FileUpload
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                maxSize={10 * 1024 * 1024}
                disabled={uploadingDoc === "EOI_DOCUMENT"}
                file={
                  eoiDocument
                    ? {
                        name: eoiDocument.fileName,
                        size: eoiDocument.fileSize,
                        url: eoiDocument.fileUrl,
                        status: uploadingDoc === "EOI_DOCUMENT" ? "uploading" : "success",
                      }
                    : null
                }
                onUpload={(file) => void uploadCpDoc("EOI_DOCUMENT", file)}
                onRemove={() => setEoiDocument(null)}
                onSizeError={(file, max) =>
                  addToast({
                    type: "error",
                    title: "File too large",
                    message: `${file.name} exceeds ${Math.round(max / (1024 * 1024))}MB`,
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Cancelled cheque *</label>
              <FileUpload
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                maxSize={10 * 1024 * 1024}
                disabled={uploadingDoc === "CHEQUE"}
                file={
                  chequeDocument
                    ? {
                        name: chequeDocument.fileName,
                        size: chequeDocument.fileSize,
                        url: chequeDocument.fileUrl,
                        status: uploadingDoc === "CHEQUE" ? "uploading" : "success",
                      }
                    : null
                }
                onUpload={(file) => void uploadCpDoc("CHEQUE", file)}
                onRemove={() => setChequeDocument(null)}
                onSizeError={(file, max) =>
                  addToast({
                    type: "error",
                    title: "File too large",
                    message: `${file.name} exceeds ${Math.round(max / (1024 * 1024))}MB`,
                  })
                }
              />
            </div>
          </div>
        )}

        {step === reviewStep && (
          <div className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-blue-50 p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span className="font-medium">{activeProjectName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{form.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium">{form.mobile}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FOS Name</span><span className="font-medium">{form.fosName}</span></div>
                {form.configuration && <div className="flex justify-between"><span className="text-muted-foreground">Unit Preference</span><span className="font-medium">{form.configuration}</span></div>}
                {form.budget && <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium">{form.budget}</span></div>}
                {isCpFilled && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">EOI Document</span><span className="font-medium">{eoiDocument?.fileName || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cancelled cheque</span><span className="font-medium">{chequeDocument?.fileName || "—"}</span></div>
                  </>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {isCpFilled
                  ? "Submit for admin review. You will be notified if corrections are needed."
                  : confirmationFlowEnabled === true
                    ? "Save as draft without emailing the customer, or send a confirmation email now. Phone and email stay protected for 15 days after punch."
                    : confirmationFlowEnabled === false
                      ? "Submit this EOI to save the customer. Phone and email stay protected for 15 days after punch."
                      : "Loading portal permissions…"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep(reviewStep - 1)} disabled={loading}>
                Back
              </Button>
              {isCpFilled ? (
                <Button
                  variant="gold"
                  loading={loading}
                  disabled={!canProceed || !eoiDocument || !chequeDocument}
                  onClick={() => handleSubmit(false)}
                >
                  Submit EOI
                </Button>
              ) : confirmationFlowEnabled === null ? (
                <Button variant="gold" disabled>
                  Loading…
                </Button>
              ) : confirmationFlowEnabled ? (
                <>
                  <Button variant="outline" loading={loading} disabled={!canProceed} onClick={() => handleSubmit(false)}>
                    Save as Draft
                  </Button>
                  <Button variant="gold" loading={loading} disabled={!canProceed} onClick={() => handleSubmit(true)}>
                    Send Confirmation
                  </Button>
                </>
              ) : (
                <Button variant="gold" loading={loading} disabled={!canProceed} onClick={() => handleSubmit(false)}>
                  Submit EOI
                </Button>
              )}
            </div>
          </div>
        )}

        {step === successStep && (
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {cpEoiSubmitted
                ? "EOI Submitted for Review"
                : sentConfirmation
                  ? "Confirmation Sent"
                  : "Customer Saved"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {cpEoiSubmitted
                ? "Admin will review the EOI document and cancelled cheque. Track status under My EOIs."
                : sentConfirmation
                  ? "A confirmation email has been sent to the customer. They must accept before proceeding with the EOI."
                  : emailWarning
                    ? "The customer was saved but the confirmation email could not be delivered."
                    : confirmationFlowEnabled === true
                      ? "The customer has been saved. You can send a confirmation email later from the leads page."
                      : "The EOI has been submitted successfully."}
            </p>
            {createdLeadId && (
              <div className="mt-4 rounded-lg border border-border bg-blue-50/60 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Lead ID</p>
                <p className="font-mono text-sm font-semibold text-foreground">{createdLeadId}</p>
              </div>
            )}
            {lockExpiresAt && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  <Clock className="h-4 w-4" />
                  Phone &amp; email lock
                </div>
                <p className="mt-1 font-mono text-lg font-semibold text-amber-800">
                  {formatLockCountdown(lockExpiresAt, now)}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Other CPs cannot register this phone or email until the timer ends. You can still add other projects from My Leads.
                </p>
              </div>
            )}
            {availableProjects.length > 0 && (
              <div className="mt-4 space-y-2 text-left">
                <Select
                  label="Punch another project now"
                  value={duplicateMapProjectId}
                  onChange={(e) => setDuplicateMapProjectId(e.target.value)}
                  options={[
                    { value: "", label: "Select project…" },
                    ...availableProjects.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.action === "EOI" ? "EOI" : "Lead"})`,
                    })),
                  ]}
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedMapProject}
                    onClick={handleMapProject}
                  >
                    {selectedMapProject?.action === "LEAD_ONLY" ? "Punch Lead" : "Continue"}
                  </Button>
                </div>
              </div>
            )}
            {devLinks && (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-blue-50/50 p-4 text-left text-xs">
                <p className="font-medium text-foreground mb-2">Dev mode — share these links with the customer:</p>
                <p className="break-all text-muted-foreground">
                  Accept:{" "}
                  <a href={devLinks.acceptUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                    {devLinks.acceptUrl}
                  </a>
                </p>
                <p className="break-all text-muted-foreground mt-1">
                  Reject:{" "}
                  <a href={devLinks.rejectUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                    {devLinks.rejectUrl}
                  </a>
                </p>
              </div>
            )}
            <Button variant="gold" className="mt-6" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </MultiStepForm>
      )}
    </Modal>
  );
}
