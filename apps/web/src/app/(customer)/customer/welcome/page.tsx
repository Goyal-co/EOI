"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button, Timeline, Card, CardContent, Select } from "@goyal/ui";
import { brand } from "@goyal/ui";
import { useCustomerDashboard } from "@/lib/hooks";
import { ArrowRight, Clock, Headphones, Shield } from "lucide-react";

const EOI_BG = "/images/auth/customer-eoi-bg.png";

export default function CustomerWelcomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedEoiId, setSelectedEoiId] = useState<string | null>(null);
  const { data: dashboard } = useCustomerDashboard(selectedEoiId);

  const entries = dashboard?.eois || [];
  const activeEoiId = selectedEoiId || dashboard?.activeEoiId || entries[0]?.eoiId || null;
  const activeEntry = entries.find((e) => e.eoiId === activeEoiId) || entries[0];

  const eoiStatus = dashboard?.hasEOI && dashboard.eoi ? dashboard.eoi.status : "PENDING_SUBMISSION";
  const needsEOI = ["PENDING_SUBMISSION", "DRAFT", "CORRECTION_REQUESTED"].includes(eoiStatus);

  const steps = [
    {
      id: "invite",
      title: "Association Confirmed",
      description: "Your Channel Partner initiated an EOI on your behalf",
      status: "completed" as const,
    },
    {
      id: "account",
      title: "Account Created",
      description: `Signed in as ${session?.user?.email || "your Google account"}`,
      status: "completed" as const,
    },
    {
      id: "eoi",
      title: "Complete EOI Form",
      description: "Fill in personal, address, unit preference & bank details",
      status: needsEOI ? ("current" as const) : ("completed" as const),
    },
    {
      id: "documents",
      title: "Upload Documents",
      description: "Submit PAN, Aadhaar, and cheque copies",
      status: needsEOI ? ("upcoming" as const) : eoiStatus === "SUBMITTED" ? ("current" as const) : ("completed" as const),
    },
    {
      id: "approval",
      title: "Admin Review & Approval",
      description: "Your EOI will be reviewed by the Goyal Hariyana Projects team",
      status: ["APPROVED", "REJECTED", "CLOSED"].includes(eoiStatus)
        ? ("completed" as const)
        : ["SUBMITTED", "UNDER_REVIEW"].includes(eoiStatus)
          ? ("current" as const)
          : ("upcoming" as const),
    },
  ];

  const eoiQuery = activeEoiId ? `?eoiId=${activeEoiId}` : "";
  const firstName = session?.user?.name?.split(" ")[0] || "there";
  const projectName = dashboard?.project?.name ?? activeEntry?.project?.name ?? "your project";

  return (
    <div
      className="relative min-h-[100dvh]"
      style={{
        backgroundImage: `url(${EOI_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-white/80" aria-hidden="true" />

      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-hover text-sm font-bold text-white">
              G
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{brand.appName}</p>
              <p className="text-xs text-gold font-medium">Customer Portal</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = "mailto:support@goyalprojects.com"; }}
          >
            <Headphones className="h-4 w-4 mr-1.5" />
            Need Help?
          </Button>
        </div>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-semibold text-navy sm:text-4xl">
            Welcome, {firstName}!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your EOI journey for <span className="font-medium text-foreground">{projectName}</span> starts here.
          </p>
        </div>

        {entries.length > 1 && (
          <div className="mb-6">
            <Select
              label="Select Project"
              value={activeEoiId || ""}
              onChange={(e) => setSelectedEoiId(e.target.value || null)}
              options={entries.map((entry) => ({
                value: entry.eoiId || "",
                label: `${entry.project?.name || "Project"} — ${entry.eoi?.status || entry.journeyStatus || "Pending"}`,
              }))}
            />
          </div>
        )}

        <Card className="border-border/60 bg-white/95 shadow-card">
          <CardContent className="p-8">
            <h2 className="text-lg font-semibold text-foreground mb-6">Your EOI Journey</h2>
            <Timeline steps={steps} />
          </CardContent>
        </Card>

        <div className="mt-8 flex justify-center">
          {needsEOI ? (
            <Button variant="gold" size="lg" onClick={() => router.push(`/customer/eoi${eoiQuery}`)}>
              Start EOI Form
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="gold" size="lg" onClick={() => router.push("/customer")}>
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Trust strip */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Shield, title: "Secure & Trusted", desc: "Your information is safe with us." },
            { icon: Clock, title: "Save & Continue Later", desc: "Your progress is saved automatically." },
            { icon: Headphones, title: "Need Assistance?", desc: "Our team is here to help you." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border/60 bg-white/90 p-4 text-center shadow-sm">
              <Icon className="mx-auto mb-2 h-5 w-5 text-gold" />
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
