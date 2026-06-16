"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, useToast, AuthLayout } from "@goyal/ui";
import { Eye, EyeOff } from "lucide-react";

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
      subtitle="Grow Your Business with Premium Projects"
      stats={[
        { label: "Projects", value: "12+" },
        { label: "Partners", value: "200+" },
        { label: "EOIs", value: "1K+" },
      ]}
    >
      <h2 className="text-page-title">Welcome back</h2>
      <p className="text-caption mb-8 mt-1">Sign in to your partner account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partner@company.com"
          required
        />
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-muted-foreground hover:text-foreground"
            suppressHydrationWarning
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <Link href="/partner/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="gold" className="w-full" loading={loading}>
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/partner/register" className="text-blue-600 font-medium hover:underline">
          Register as Partner
        </Link>
      </p>
    </AuthLayout>
  );
}
