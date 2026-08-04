"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout, Button, Input } from "@goyal/ui";
import { AlertCircle, Building2, FileCheck, Shield, Users } from "lucide-react";

const LOGIN_BG = "/images/auth/customer-login-bg.png";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Sign-in was denied. Use the email and password from your EOI invitation email.",
  CredentialsSignin: "Invalid email or password. You can reset your password below.",
  EmailAlreadyRegistered:
    "This email is already registered. Sign in with the correct portal or use a different email.",
  EmailRegisteredAsPartner:
    "This email is registered as a Channel Partner. Please use the partner login instead.",
  Configuration:
    "Sign-in is not configured. Ask your administrator to check auth environment variables.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in callback failed. Please try again.",
  OAuthAccountNotLinked:
    "This Google account is not linked. Prefer email/password from your invitation email.",
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers) => setGoogleEnabled(Boolean(providers.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default) : null;

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl: "/customer/welcome",
      });
      if (result?.error) {
        setFormError(ERROR_MESSAGES.CredentialsSignin);
        return;
      }
      window.location.href = result?.url || "/customer/welcome";
    } catch {
      setFormError(ERROR_MESSAGES.Default);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      portalLabel="Customer Portal"
      backgroundImage={LOGIN_BG}
      subtitle="Welcome to your exclusive portal"
      highlightSubtitle="exclusive portal"
      description="Access all your project information, submissions and documents in one secure place."
      stats={[
        { label: "Years", value: "55+", icon: Building2 },
        { label: "Projects", value: "250+", icon: Building2 },
        { label: "Loyal Customers", value: "30+", icon: Users },
      ]}
      legacyCard={{
        title: "A Legacy Built on Trust",
        body: "For over five decades, Goyal & Co. | Hariyana Group has been delivering excellence in real estate with unwavering commitment to quality, transparency & customer satisfaction.",
      }}
      formCardTitle="Log in to continue"
      formCardSubtitle="Use the email and password from your EOI invitation email."
    >
      <ul className="mb-6 space-y-2 rounded-lg bg-blue-50/80 p-4">
        {TRUST_POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4 text-gold shrink-0" />
            {text}
          </li>
        ))}
      </ul>

      {(errorMessage || formError) && (
        <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{formError || errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleCredentialsLogin} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Link href="/customer/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button variant="gold" size="lg" className="w-full" type="submit" loading={loading}>
          Sign in
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/customer/welcome" })}
          >
            Continue with Google
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Login page is the same for all customers. Use the credentials emailed after you accept the Channel Partner confirmation.
      </p>
    </AuthLayout>
  );
}
