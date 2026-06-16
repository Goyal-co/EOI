"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Modal, Button, Input, Select, Textarea, MultiStepForm, useToast,
} from "@goyal/ui";
import { CheckCircle } from "lucide-react";
import type { LeadCreateInput } from "@goyal/types";

const STEPS = [
  { id: "customer", title: "Customer Details", description: "Register customer interest for this closed project" },
  { id: "review", title: "Review", description: "Verify details before punching the lead" },
  { id: "success", title: "Success", description: "Lead punched" },
];

interface PunchLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function PunchLeadModal({ open, onOpenChange, projectId, projectName }: PunchLeadModalProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const [devLinks, setDevLinks] = useState<{ acceptUrl: string; rejectUrl: string } | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
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

  const reset = () => {
    setStep(0);
    setSentConfirmation(false);
    setDevLinks(null);
    setEmailWarning(null);
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          projectId,
          intentType: "LEAD_ONLY",
          sendConfirmation: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.code === "DUPLICATE_LEAD") {
          throw new Error("A lead already exists for this customer on this project.");
        }
        throw new Error(data.error || "Failed to punch lead");
      }

      setSentConfirmation(!!data.sentConfirmation);
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
        type: data.sentConfirmation ? "success" : "warning",
        title: data.sentConfirmation ? "Confirmation sent" : "Lead punched — email not sent",
        message: data.sentConfirmation
          ? "Customer will receive a confirmation email to accept interest."
          : data.emailError || "Use the dev links below or resend from Leads.",
      });
    } catch (err) {
      addToast({ type: "error", title: "Punch failed", message: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={handleClose} title={`Punch Lead — ${projectName}`} size="lg">
      <MultiStepForm
        steps={STEPS}
        currentStep={step}
        isLastStep={false}
        loading={loading}
        canProceed={canProceed}
        onPrevious={step > 0 && step < 2 ? () => setStep(step - 1) : undefined}
        onNext={step === 0 ? () => setStep(1) : undefined}
        nextLabel="Continue"
      >
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
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
              EOI is closed for this project. Punching a lead registers customer interest only — no EOI form or admin approval.
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-blue-50 p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span className="font-medium">{projectName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{form.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium">{form.mobile}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.email}</span></div>
              </div>
              <p className="text-muted-foreground text-xs">
                A confirmation email will be sent to the customer. Once they accept, the lead is complete.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep(0)} disabled={loading}>
                Back
              </Button>
              <Button variant="gold" loading={loading} disabled={!canProceed} onClick={handleSubmit}>
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
              {sentConfirmation ? "Lead Punched — Confirmation Sent" : "Lead Punched"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {sentConfirmation
                ? "The customer must accept the confirmation email to complete this lead."
                : emailWarning || "Confirmation email could not be delivered."}
            </p>
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
