"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button, Timeline, Card, CardContent, PageHeader, Select } from "@goyal/ui";
import { useCustomerDashboard } from "@/lib/hooks";
import { ArrowRight } from "lucide-react";

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
      description: "Your EOI will be reviewed by the Goyal Projects team",
      status: ["APPROVED", "REJECTED", "CLOSED"].includes(eoiStatus)
        ? ("completed" as const)
        : ["SUBMITTED", "UNDER_REVIEW"].includes(eoiStatus)
          ? ("current" as const)
          : ("upcoming" as const),
    },
  ];

  const eoiQuery = activeEoiId ? `?eoiId=${activeEoiId}` : "";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title={`Welcome, ${session?.user?.name?.split(" ")[0] || "there"}!`}
        description={
          dashboard?.hasEOI
            ? `Your EOI journey for ${dashboard.project?.name ?? activeEntry?.project?.name ?? "your project"} starts here.`
            : "Let's get you started with your Expression of Interest."
        }
      />

      {entries.length > 1 && (
        <Select
          label="Select Project"
          value={activeEoiId || ""}
          onChange={(e) => setSelectedEoiId(e.target.value || null)}
          options={entries.map((entry) => ({
            value: entry.eoiId || "",
            label: `${entry.project?.name || "Project"} — ${entry.eoi?.status || entry.journeyStatus || "Pending"}`,
          }))}
        />
      )}

      <Card>
        <CardContent className="p-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Your EOI Journey</h2>
          <Timeline steps={steps} />
        </CardContent>
      </Card>

      <div className="flex gap-4 justify-center">
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
    </div>
  );
}
