"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, CardContent, LoadingSkeleton, PublicPageCard, formatCurrency } from "@goyal/ui";
import { MapPin, Building2 } from "lucide-react";

interface InviteData {
  customerName: string;
  customerEmail: string;
  project: {
    id: string;
    name: string;
    location: string;
    startingPrice: number;
    bannerUrl?: string;
  };
  cpName: string;
  companyName: string;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error((body as { error?: string })?.error || "Invalid invitation");
        }
        return body;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Invalid invitation"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <PublicPageCard title="Expression of Interest Invitation">
        <LoadingSkeleton rows={4} />
      </PublicPageCard>
    );
  }

  if (error || !data) {
    return (
      <PublicPageCard title="Invitation Not Found" description={error || "This invitation link is invalid or has expired."}>
        <p className="text-center text-muted-foreground text-sm">Please contact your channel partner for a new invite link.</p>
      </PublicPageCard>
    );
  }

  return (
    <PublicPageCard title="Expression of Interest Invitation">
      <p className="text-foreground text-base mb-4">Dear {data.customerName},</p>
      <p className="text-muted-foreground leading-relaxed mb-6">
        <strong className="text-foreground">{data.cpName}</strong> from{" "}
        <strong className="text-foreground">{data.companyName}</strong> has initiated an
        Expression of Interest (EOI) for you at:
      </p>

      <div className="rounded-lg border border-border overflow-hidden mb-6">
        {data.project.bannerUrl && (
          <div className="h-32 bg-blue-100 overflow-hidden">
            <img src={data.project.bannerUrl} alt={data.project.name} className="h-full w-full object-cover" />
          </div>
        )}
        <CardContent className="p-4 bg-blue-50">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">{data.project.name}</h2>
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5" />
                {data.project.location}
              </div>
              <p className="text-gold font-semibold mt-2">
                Starting {formatCurrency(Number(data.project.startingPrice))}
              </p>
            </div>
          </div>
        </CardContent>
      </div>

      <div className="text-center">
        <Button
          variant="gold"
          size="lg"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl: "/customer/welcome" })}
        >
          Continue with Google
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Please login using <strong>{data.customerEmail}</strong> — the email provided by your Channel Partner.
        </p>
      </div>
    </PublicPageCard>
  );
}
