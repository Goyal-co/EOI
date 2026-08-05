"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, LoadingSkeleton, PublicPageCard } from "@goyal/ui";
import { CheckCircle, Mail, XCircle } from "lucide-react";

interface AcceptResult {
  intentType?: string | null;
  loginUrl?: string;
  leadId?: string | null;
  customerName?: string;
  customerEmail?: string;
  projectName?: string;
  alreadyAccepted?: boolean;
  passwordEmailed?: boolean;
}

export default function ConfirmAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AcceptResult | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    fetch(`/api/confirm/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to confirm");
        setResult(data);
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

  if (error || !result) {
    return (
      <PublicPageCard title="Confirmation Failed">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-error mx-auto mb-4" />
          <p className="text-muted-foreground">{error || "Something went wrong"}</p>
        </div>
      </PublicPageCard>
    );
  }

  const isLeadOnly = result.intentType === "LEAD_ONLY";
  const loginUrl = result.loginUrl || "/customer/login";

  return (
    <PublicPageCard title={isLeadOnly ? "Interest Confirmed" : "Confirmation Accepted"}>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
        </div>

        <p className="text-muted-foreground">
          {result.customerName ? `Thank you, ${result.customerName}. ` : "Thank you. "}
          {isLeadOnly
            ? "Your interest has been confirmed."
            : "Your Channel Partner association has been confirmed."}
        </p>

        {(result.leadId || result.projectName) && (
          <div className="mt-5 space-y-2 rounded-lg border border-border p-4 text-left text-sm">
            {result.projectName && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium text-foreground">{result.projectName}</span>
              </div>
            )}
            {result.leadId && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Lead ID</span>
                <span className="font-mono font-medium text-foreground">{result.leadId}</span>
              </div>
            )}
            {result.customerEmail && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Login ID</span>
                <span className="font-medium text-foreground break-all">{result.customerEmail}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Mail className="h-4 w-4" />
            {result.passwordEmailed === false
              ? "Check your mail for your login ID"
              : "Check your mail for your ID and password"}
          </div>
          <p className="mt-2 text-xs text-amber-800">
            {result.passwordEmailed === false
              ? "We have emailed your Customer Portal login ID. Sign in with your existing password, or reset it from the login page."
              : `We have emailed your Customer Portal login ID and password${
                  result.customerEmail ? ` to ${result.customerEmail}` : ""
                }. Use them to sign in, then reset your password from the login page whenever you like.`}
          </p>
        </div>

        <Link href={loginUrl} className="mt-6 block">
          <Button variant="gold" className="w-full">
            Continue to Customer Login
          </Button>
        </Link>
      </div>
    </PublicPageCard>
  );
}
