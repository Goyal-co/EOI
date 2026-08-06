"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Modal, Button, Input, Select, Textarea, MultiStepForm, useToast,
} from "@goyal/ui";
import { CheckCircle, Clock, Layers3 } from "lucide-react";
import type { LeadCreateInput } from "@goyal/types";

const STEPS = [
  { id: "customer", title: "Customer Details", description: "Register customer interest for this project" },
  { id: "review", title: "Review", description: "Verify details before punching the lead" },
  { id: "success", title: "Success", description: "Lead punched" },
];

type AvailableProject = {
  id: string;
  name: string;
  location: string;
  eoiStatus: string;
  action: "EOI" | "LEAD_ONLY";
};

interface PunchLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  initialLead?: Pick<
    LeadCreateInput,
    "customerName" | "mobile" | "email" | "configuration" | "fosName" | "budget" | "city" | "notes"
  >;
  /** When set, parent handles opening the other intent modal for another project */
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

export function PunchLeadModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  initialLead,
  onMapToProject,
}: PunchLeadModalProps) {
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
    intentType: "LEAD_ONLY",
  });
  const { addToast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setActiveProjectId(projectId);
    setActiveProjectName(projectName);
  }, [open, projectId, projectName]);

  useEffect(() => {
    if (!open || !initialLead) return;
    setForm((current) => ({
      ...current,
      ...initialLead,
      projectId: activeProjectId,
      intentType: "LEAD_ONLY",
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
      intentType: "LEAD_ONLY",
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
      : true;

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
    if (selectedMapProject.action === "EOI") {
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
        message: "Select this customer and use Map to another project to register an EOI.",
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
      message: `Continue to punch this customer on ${selectedMapProject.name}.`,
    });
  };

  const handleSubmit = async (sendConfirmation: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          projectId: activeProjectId,
          intentType: "LEAD_ONLY",
          sendConfirmation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.code === "DUPLICATE_LEAD") {
          setAvailableProjects(data.availableProjects || []);
          setLockExpiresAt(data.lockExpiresAt || null);
          setShowDuplicateMap(true);
          addToast({
            type: "warning",
            title: "Already registered on this project",
            message: "Use the project dropdown below to map this customer to another project, or open My Leads.",
          });
          return;
        }
        throw new Error(data.error || "Failed to punch lead");
      }

      setSentConfirmation(!!data.sentConfirmation);
      setCreatedLeadId(data.lead?.leadId || null);
      setLockExpiresAt(data.lockExpiresAt || null);
      setAvailableProjects(data.availableProjects || []);
      setDevLinks(data.devConfirmationLinks || null);
      setEmailWarning(
        data.emailError
        || (data.emailMocked
          ? "Email was not sent — restart the server after adding BREVO_API_KEY to .env.local"
          : null)
      );
      setStep(2);
      qc.invalidateQueries({ queryKey: ["partner", "leads"] });
      qc.invalidateQueries({ queryKey: ["partner", "analytics"] });
      addToast({
        type: data.sentConfirmation ? "success" : sendConfirmation ? "warning" : "success",
        title: sendConfirmation
          ? (data.sentConfirmation ? "Confirmation sent" : "Lead punched — email not sent")
          : "Lead saved as draft",
        message: sendConfirmation
          ? (data.sentConfirmation
            ? "Customer will receive a confirmation email to accept interest."
            : data.emailError || "Use the dev links below or resend from Leads.")
          : "You can send confirmation later from the leads page.",
      });
    } catch (err) {
      addToast({ type: "error", title: "Punch failed", message: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={handleClose} title={`Punch Lead — ${activeProjectName}`} size="lg">
      <MultiStepForm
        steps={STEPS}
        currentStep={step}
        isLastStep={false}
        loading={loading}
        canProceed={canProceed && !showDuplicateMap}
        onPrevious={step > 0 && step < 2 ? () => setStep(step - 1) : undefined}
        onNext={step === 0 ? () => setStep(1) : undefined}
        nextLabel="Continue"
      >
        {showDuplicateMap && (
          <div className="mb-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Layers3 className="h-4 w-4" />
              Customer already on this project
            </div>
            <p className="text-xs text-amber-800">
              Phone and email stay under your 15-day protection. Map this same customer to another project below.
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
              placeholder="Field officer name (optional)"
            />
            <Select
              label="Unit Preference"
              value={form.configuration || ""}
              onChange={(e) => setForm({ ...form, configuration: e.target.value })}
              options={[
                { value: "", label: "Select unit preference (optional)" },
                { value: "2 BHK", label: "2 BHK" },
                { value: "3 BHK", label: "3 BHK" },
                { value: "4 BHK", label: "4 BHK" },
                { value: "Penthouse", label: "Penthouse" },
              ]}
            />
            <Select
              label="Budget Range"
              value={form.budget || ""}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              options={[
                { value: "", label: "Select budget (optional)" },
                { value: "50L - 75L", label: "₹50L - ₹75L" },
                { value: "75L - 1Cr", label: "₹75L - ₹1Cr" },
                { value: "1Cr - 1.5Cr", label: "₹1Cr - ₹1.5Cr" },
                { value: "1.5Cr+", label: "₹1.5Cr+" },
              ]}
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

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-blue-50 p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span className="font-medium">{activeProjectName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{form.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium">{form.mobile}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.email}</span></div>
              </div>
              <p className="text-muted-foreground text-xs">
                Save as draft without emailing, or send a confirmation email now. Phone and email stay protected for 15 days after punch.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep(0)} disabled={loading}>
                Back
              </Button>
              <Button variant="outline" loading={loading} disabled={!canProceed} onClick={() => handleSubmit(false)}>
                Save as Draft
              </Button>
              <Button variant="gold" loading={loading} disabled={!canProceed} onClick={() => handleSubmit(true)}>
                Punch Lead &amp; Send Confirmation
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {sentConfirmation ? "Lead Punched — Confirmation Sent" : "Lead Saved"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {sentConfirmation
                ? "The customer must accept the confirmation email to complete this lead."
                : emailWarning || "The lead was saved. You can send confirmation later from the leads page."}
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
                  15-day phone &amp; email lock
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
                    {selectedMapProject?.action === "EOI" ? "Register EOI" : "Continue"}
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
    </Modal>
  );
}
