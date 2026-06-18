"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout, Button } from "@goyal/ui";
import { AlertCircle, Building2, FileCheck, Shield, Users } from "lucide-react";

const LOGIN_BG = "/images/auth/customer-login-bg.png";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Google sign-in was denied. Use the same email your Channel Partner registered, and ensure you have accepted the confirmation email first.",
  EmailAlreadyRegistered:
    "This email is already registered. Sign in with the correct portal or use a different email.",
  EmailRegisteredAsPartner:
    "This email is registered as a Channel Partner. Please use the partner login instead.",
  Configuration:
    "Google sign-in is not configured. Ask your administrator to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in callback failed. Please try again.",
  OAuthAccountNotLinked:
    "This Google account is not linked to a customer invitation. Use the email your Channel Partner registered.",
  Default: "Sign-in failed. Please try again.",
};

const TRUST_POINTS = [
  { icon: Building2, text: "Brochures, floor plans & cost sheets" },
  { icon: FileCheck, text: "EOI submission & tracking" },
  { icon: Shield, text: "Secure document uploads" },
];

export default function CustomerLoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers) => setGoogleEnabled(Boolean(providers.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default) : null;

  return (
    <AuthLayout
      portalLabel="Customer Portal"
      backgroundImage={LOGIN_BG}
      subtitle="Welcome to your exclusive portal"
      highlightSubtitle="exclusive portal"
      description="Access all your project information, submissions and documents in one secure place."
      stats={[
        { label: "Years of Legacy", value: "53+", icon: Building2 },
        { label: "Completed Projects", value: "250+", icon: Building2 },
        { label: "Loyal Customers", value: "30k+", icon: Users },
      ]}
      legacyCard={{
        title: "A Legacy Built on Trust",
        body: "For over five decades, Goyal & Co. | Hariyana Group has been delivering excellence in real estate with unwavering commitment to quality, transparency & customer satisfaction.",
      }}
      formCardTitle="Sign in to continue"
      formCardSubtitle="Use the Google account linked to your invitation email."
    >
      <ul className="mb-6 space-y-2 rounded-lg bg-blue-50/80 p-4">
        {TRUST_POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4 text-gold shrink-0" />
            {text}
          </li>
        ))}
      </ul>

      {errorMessage && (
        <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {googleEnabled === false && (
        <div className="mb-6 rounded-lg border border-border bg-blue-50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Google sign-in not configured</p>
          <p className="mt-1">
            Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment, then restart the server.
          </p>
        </div>
      )}

      <Button
        variant="gold"
        size="lg"
        className="w-full"
        disabled={googleEnabled === false}
        onClick={() => signIn("google", { callbackUrl: "/customer/welcome" })}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Use the same email address your Channel Partner registered for you.
        You must accept the confirmation email before signing in.
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Partner or admin?{" "}
        <Link href="/partner/login" className="font-medium text-blue-600 hover:underline">
          Partner login
        </Link>
        {" · "}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Admin login
        </Link>
      </p>
    </AuthLayout>
  );
}
