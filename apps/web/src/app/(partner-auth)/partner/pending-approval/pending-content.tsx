"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, AuthLayout } from "@goyal/ui";
import { Building2, Clock, Ban, FileText, Shield, Users } from "lucide-react";

const LOGIN_BG = "/images/auth/customer-login-bg.png";

export default function PartnerPendingApprovalContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const isBlocked = searchParams.get("status") === "blocked";
  const [supportEmail, setSupportEmail] = useState("admin@goyalprojects.com");

  useEffect(() => {
    fetch("/api/public/support-email")
      .then((r) => r.json())
      .then((data) => {
        if (data.supportEmail) setSupportEmail(data.supportEmail);
      })
      .catch(() => {});
  }, []);

  return (
    <AuthLayout
      backgroundImage={LOGIN_BG}
      subtitle="Join our network of property advisor"
      description=""
      features={[
        { icon: Building2, title: "Premium Projects", description: "Access all new/ongoing projects." },
        { icon: FileText, title: "Sales Resources", description: "Brochures, floor plans & cost sheets." },
        { icon: Users, title: "EOI Management", description: "Submit and track customer EOIs." },
      ]}
      stats={[
        { label: "Years", value: "55+" },
        { label: "Projects", value: "250+" },
        { label: "Loyal Customers", value: "30+" },
      ]}
      formCardTitle={isBlocked ? "Account Blocked" : "Pending Approval"}
      formCardSubtitle={
        isBlocked
          ? "Your partner account cannot sign in right now"
          : "Your registration is under review"
      }
      formCardIcon={Shield}
    >
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isBlocked ? "bg-red-100" : "bg-amber-100"}`}>
            {isBlocked ? (
              <Ban className="h-8 w-8 text-red-600" />
            ) : (
              <Clock className="h-8 w-8 text-amber-600" />
            )}
          </div>
        </div>

        {email && (
          <p className="text-sm font-medium text-foreground mb-4">{email}</p>
        )}

        {isBlocked ? (
          <p className="text-muted-foreground mb-6">
            Your channel partner account has been blocked. Please contact{" "}
            <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">
              {supportEmail}
            </a>{" "}
            for assistance.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">
              Your channel partner registration has been submitted successfully. Our admin team is reviewing
              your application.
            </p>
            <div className="text-left rounded-lg bg-blue-50 p-4 mb-6 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Admin reviews your RERA, PAN, and firm details</li>
                <li>Once approved, you receive login credentials by email</li>
                <li>You can then access assigned projects and create customer leads</li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Until approval, you cannot access projects, submit leads, or manage EOIs.
            </p>
          </>
        )}

        <Link href="/partner/login">
          <Button variant="outline">Back to Login</Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
