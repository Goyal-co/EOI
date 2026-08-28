"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Input, AuthLayout, useToast } from "@goyal/ui";
import { Eye, EyeOff, Lock, Shield } from "lucide-react";

const LOGIN_BG = "/images/auth/customer-login-bg.png";

export default function CustomerResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addToast({ type: "error", title: "Passwords do not match" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      addToast({ type: "success", title: "Password updated" });
      router.push("/customer/login");
    } catch (err) {
      addToast({ type: "error", title: "Reset failed", message: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      backgroundImage={LOGIN_BG}
      subtitle="Your Expression of Interest portal"
      description=""
      formCardTitle="Set New Password"
      formCardSubtitle="Choose a strong password for your customer account"
      formCardIcon={Shield}
    >
      <div className="flex justify-center mb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Lock className="h-8 w-8 text-blue-600" />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label="New Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[2.35rem] text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <Input
            label="Confirm Password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-[2.35rem] text-muted-foreground hover:text-foreground"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button variant="gold" className="w-full" loading={loading} type="submit">
          Update Password
        </Button>
      </form>
    </AuthLayout>
  );
}
