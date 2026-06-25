"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthLayout, Button, Input, useToast } from "@goyal/ui";
import { Building2, Eye, EyeOff, FileText, Lock, Mail, Shield, Users } from "lucide-react";

/** Single-building sketch BG — admin + customer login + CP login */
const LOGIN_BG = "/images/auth/customer-login-bg.png";

export default function AdminLoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      addToast({ type: "error", title: "Login failed", message: "Invalid email or password" });
      return;
    }

    router.push("/admin");
  };

  return (
    <AuthLayout
      portalLabel="Admin Portal"
      backgroundImage={LOGIN_BG}
      subtitle="Manage projects, EOIs, and channel partners"
      highlightSubtitle="channel partners"
      description="Streamline expression of interest across channel partners & customers."
      features={[
        { icon: Building2, title: "Projects Management", description: "Create, update and manage all project information." },
        { icon: FileText, title: "EOI Oversight", description: "Track and manage EOIs across all projects." },
        { icon: Users, title: "Channel Partner Management", description: "Manage partners, access and performance." },
      ]}
      featuresPosition="bottom"
      showDescriptionDivider
      formCardTitle="Admin Portal"
      formCardSubtitle="Log in to manage projects, EOIs, and channel partners."
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
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded accent-gold"
            />
            Remember me
          </label>
          <Link href="/partner/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot Password?
          </Link>
        </div>
        <Button type="submit" variant="gold" className="w-full" loading={loading}>
          Log In
        </Button>
      </form>

      <div className="relative mt-8 border-t border-border pt-5">
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-3 text-xs text-muted-foreground">
          Secure Access
        </span>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-gold" />
          Authorized administrators only
        </p>
      </div>
    </AuthLayout>
  );
}
