"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, LoadingSkeleton, PublicPageCard } from "@goyal/ui";
import { CheckCircle, XCircle } from "lucide-react";

export default function ConfirmAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/confirm/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to confirm");
        setSuccess(true);
        setIntentType(data.intentType || null);
        setInviteUrl(data.devInviteUrl || data.inviteUrl || null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <PublicPageCard title="Confirming...">
        <LoadingSkeleton rows={3} />
      </PublicPageCard>
    );
  }

  if (error) {
    return (
      <PublicPageCard title="Confirmation Failed">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-error mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </PublicPageCard>
    );
  }

  const isLeadOnly = intentType === "LEAD_ONLY";

  return (
    <PublicPageCard title={isLeadOnly ? "Interest Confirmed" : "Confirmation Accepted"}>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <p className="text-muted-foreground mb-6">
          {isLeadOnly
            ? "Thank you for confirming your interest. Our team and your Channel Partner will reach out with next steps. No further action is required."
            : "Thank you for confirming your interest. You will receive an email with instructions to complete your Expression of Interest."}
        </p>
        {!isLeadOnly && inviteUrl && (
          <p className="mb-4 break-all rounded-lg border border-dashed border-border bg-blue-50/50 p-3 text-xs text-muted-foreground">
            Continue here:{" "}
            <a href={inviteUrl} className="text-blue-600 hover:underline">
              {inviteUrl}
            </a>
          </p>
        )}
        {!isLeadOnly && success && (
          <Link href="/customer/login">
            <Button variant="gold" className="w-full">
              Continue to Customer Login
            </Button>
          </Link>
        )}
      </div>
    </PublicPageCard>
  );
}
