"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, AuthLayout, useToast } from "@goyal/ui";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSent(true);
      addToast({ type: "success", title: "Check your email", message: data.message });
    } catch (err) {
      addToast({ type: "error", title: "Request failed", message: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout portalLabel="Partner Portal">
      <Link href="/partner/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to login
      </Link>

      <Card className="p-8">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h2 className="text-page-title text-center">Reset Password</h2>
        <p className="text-caption mt-3 mb-6 text-center">
          Enter your partner account email and we will send a reset link.
        </p>

        {sent ? (
          <p className="text-sm text-muted-foreground text-center">
            If an account exists for <strong>{email}</strong>, you will receive a reset link shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button variant="gold" className="w-full" loading={loading} type="submit">
              Send Reset Link
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => router.push("/partner/login")}>Return to Login</Button>
        </div>
      </Card>
    </AuthLayout>
  );
}
