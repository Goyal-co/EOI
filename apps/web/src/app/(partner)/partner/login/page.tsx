"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, useToast, AuthLayout } from "@goyal/ui";
import { Eye, EyeOff, Building2, FileText, Users, Shield, Lock, Mail } from "lucide-react";

const LOGIN_BG = "/images/auth/customer-login-bg.png";

export default function PartnerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supportEmail, setSupportEmail] = useState("admin@goyalprojects.com");
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    fetch("/api/public/support-email")
      .then((r) => r.json())
      .then((data) => {
        if (data.supportEmail) setSupportEmail(data.supportEmail);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const statusRes = await fetch("/api/partner/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "pending") {
            router.push(`/partner/pending-approval?email=${encodeURIComponent(email)}`);
            return;
          }
          if (statusData.status === "blocked") {
            addToast({
              type: "error",
              title: "Account blocked",
              message: `Your channel partner account has been blocked. Contact ${supportEmail} for assistance.`,
            });
            return;
          }
        }
        addToast({ type: "error", title: "Login failed", message: "Invalid email or password" });
        return;
      }

      if (!result?.ok) {
        addToast({
          type: "error",
          title: "Login failed",
          message: "Could not establish a session. Please try again.",
        });
        return;
      }

      router.push("/partner");
      router.refresh();
    } catch {
      addToast({
        type: "error",
        title: "Login failed",
        message: "Something went wrong. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      portalLabel="Partner Portal"
      backgroundImage={LOGIN_BG}
      subtitle="Grow Your Business with Premium Projects"
      highlightSubtitle="Premium Projects"
      description="Partner with one of Bangalore's most trusted developers and access projects & marketing resources in one place."
      features={[
        { icon: Building2, title: "Premium Projects", description: "Access all new/ongoing projects." },
        { icon: FileText, title: "Sales Resources", description: "Brochures, floor plans & cost sheets." },
        { icon: Users, title: "EOI Management", description: "Submit and track customer EOIs." },
      ]}
      stats={[
        { label: "Years of Legacy", value: "53+" },
        { label: "Projects Delivered", value: "250+" },
        { label: "Happy Customers", value: "30k+" },
      ]}
      formCardTitle="Partner Login"
      formCardSubtitle="Authorized Channel Partners Only"
      formCardIcon={Shield}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-muted-foreground" />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="pl-10"
            required
          />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-muted-foreground" />
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="pl-10 pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[2.35rem] text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
            suppressHydrationWarning
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center justify-end">
          <Link href="/partner/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" variant="gold" className="w-full" loading={loading}>
          Log In
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Interested in becoming a Channel Partner?{" "}
        <Link href="/partner/register" className="text-blue-600 font-medium hover:underline">
          Sign In &gt;
        </Link>
      </p>
    </AuthLayout>
  );
}
