"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout, Button } from "@goyal/ui";
import { AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Sign-in was denied. For customers, use the Google account matching your invitation email after accepting confirmation.",
  Configuration:
    "Authentication is not fully configured. Contact your administrator.",
  OAuthSignin: "Could not start sign-in. Please try again.",
  OAuthCallback: "Sign-in callback failed. Please try again.",
  OAuthAccountNotLinked: "This account is not linked. Use the correct portal for your role.",
  Default: "Sign-in failed. Please try again.",
};

export default function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "Default";
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const isCustomerFlow =
    callbackUrl.includes("/customer") || callbackUrl.includes("/invite");
  const loginHref = isCustomerFlow ? "/customer/login" : "/login";
  const portalLabel = isCustomerFlow ? "Customer Portal" : "Admin Portal";

  const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default;

  return (
    <AuthLayout portalLabel={portalLabel} subtitle="Sign-in could not be completed">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-7 w-7 text-error" />
        </div>
        <h2 className="text-page-title">Sign-in failed</h2>
        <p className="text-caption mx-auto mt-2 max-w-sm">{message}</p>
        {errorCode !== "Default" && (
          <p className="mt-2 text-xs text-muted-foreground">Error code: {errorCode}</p>
        )}
        <Link href={`${loginHref}${errorCode ? `?error=${errorCode}` : ""}`} className="mt-8 inline-block">
          <Button variant="gold">Back to {isCustomerFlow ? "Customer" : "Admin"} Login</Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
