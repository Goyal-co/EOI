"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AuthLayout, Button, Input, useToast } from "@goyal/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState("admin@goyalprojects.com");
  const [password, setPassword] = useState("");
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
      subtitle="Manage projects, EOIs, and channel partners"
    >
      <h1 className="text-2xl font-bold text-foreground mb-1">Admin Portal</h1>
      <p className="text-muted-foreground mb-6">Sign in to manage projects, EOIs, and channel partners.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin@123"
          required
        />
        <Button type="submit" variant="gold" className="w-full" loading={loading}>
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
}
