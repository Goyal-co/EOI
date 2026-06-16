"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, Input, Button,
  LoadingSkeleton, PageHeader, FormField,
} from "@goyal/ui";
import { User, Phone, Mail, CreditCard } from "lucide-react";

interface CustomerProfile {
  id: string;
  fullName?: string;
  mobile?: string;
  panNumber?: string;
  user: { email: string; name?: string; image?: string };
}

export default function CustomerProfilePage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", mobile: "", panNumber: "" });

  const { data: profile, isLoading } = useQuery<CustomerProfile>({
    queryKey: ["customer", "profile"],
    queryFn: async () => {
      const res = await fetch("/api/customer/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName || profile.user.name || "",
        mobile: profile.mobile || "",
        panNumber: profile.panNumber || "",
      });
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", "profile"] });
      setEditing(false);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Profile"
        description="Manage your personal information."
      />

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-hover text-white text-xl font-bold">
              {(form.fullName || session?.user?.name || "C").charAt(0)}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-foreground">
              {form.fullName || session?.user?.name}
            </p>
            <p className="text-sm text-muted-foreground">{profile?.user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Personal Details</CardTitle>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="gold" size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            {editing ? (
              <FormField label="Full Name" htmlFor="customer-name">
                <Input id="customer-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </FormField>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm text-foreground">{form.fullName || "—"}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground">{profile?.user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            {editing ? (
              <FormField label="Mobile" htmlFor="customer-mobile">
                <Input id="customer-mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </FormField>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">Mobile</p>
                <p className="text-sm text-foreground">{form.mobile || "—"}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
            {editing ? (
              <FormField label="PAN Number" htmlFor="customer-pan">
                <Input id="customer-pan" value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} />
              </FormField>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">PAN Number</p>
                <p className="text-sm text-foreground">{form.panNumber || "—"}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Account type: <span className="text-foreground font-medium">Customer</span></p>
          <p>Sign-in method: <span className="text-foreground font-medium">Google</span></p>
        </CardContent>
      </Card>
    </div>
  );
}
