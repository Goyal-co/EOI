"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LoadingSkeleton, Button, PublicPageCard } from "@goyal/ui";
import { XCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface ConfirmContext {
  customerName: string;
  cpName: string;
  companyName?: string;
  project: { name: string; location: string };
  confirmationStatus: string | null;
}

export default function ConfirmRejectPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const [context, setContext] = useState<ConfirmContext | null>(null);

  useEffect(() => {
    fetch(`/api/confirm/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid confirmation link");
        setContext(data);
        if (data.confirmationStatus === "REJECTED") setRejected(true);
        if (data.confirmationStatus === "ACCEPTED") {
          setError("This invitation has already been accepted.");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleReject = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/confirm/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process rejection");
      setRejected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicPageCard title="Loading...">
        <LoadingSkeleton rows={4} />
      </PublicPageCard>
    );
  }

  if (error && !context) {
    return (
      <PublicPageCard title="Unable to Load">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-error mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </PublicPageCard>
    );
  }

  if (rejected) {
    return (
      <PublicPageCard title="Interest Declined">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Your response has been recorded. You have declined the Expression of Interest invitation.
            No further action is required.
          </p>
        </div>
      </PublicPageCard>
    );
  }

  return (
    <PublicPageCard title="Decline Association?">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          You are about to decline the Channel Partner association for this project.
        </p>
      </div>

      {context && (
        <div className="rounded-lg border border-border p-4 space-y-2 text-sm mb-6">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium text-foreground">{context.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Channel Partner</span>
            <span className="font-medium text-foreground">{context.cpName}</span>
          </div>
          {context.companyName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Company</span>
              <span className="font-medium text-foreground">{context.companyName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Project</span>
            <span className="font-medium text-foreground">{context.project.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Location</span>
            <span className="font-medium text-foreground">{context.project.location}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-error mb-4 text-center">{error}</p>}

      <div className="flex flex-col gap-3">
        <Button variant="destructive" className="w-full" loading={submitting} onClick={handleReject}>
          Yes, Decline Interest
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          This action cannot be undone. The channel partner will be notified.
        </p>
      </div>
    </PublicPageCard>
  );
}
