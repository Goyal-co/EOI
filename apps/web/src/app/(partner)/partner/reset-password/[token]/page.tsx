"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Input, Card, AuthLayout, useToast } from "@goyal/ui";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      router.push("/partner/login");
    } catch (err) {
      addToast({ type: "error", title: "Reset failed", message: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout portalLabel="Partner Portal">
      <Card className="p-8 max-w-md mx-auto">
        <h2 className="text-page-title text-center mb-6">Set New Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <Button variant="gold" className="w-full" loading={loading} type="submit">
            Update Password
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
