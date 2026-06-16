"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardHeader, CardTitle, CardContent, Button, Input, Select, useToast, LoadingSkeleton, PageHeader, FormField,
} from "@goyal/ui";
import { User, Bell, FileText, Shield } from "lucide-react";

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    phone: "",
    supportEmail: "admin@goyalprojects.com",
  });

  const [notifPrefs, setNotifPrefs] = useState({
    newEoi: true,
    cpRegistration: true,
    approvalReminders: true,
    projectUpdates: false,
    emailDigest: "daily",
  });

  const [eoiRules, setEoiRules] = useState({
    autoReview: false,
    requireCheque: true,
    minDeposit: "500000",
    maxPendingDays: "7",
    allowCorrections: true,
  });

  const [permissions, setPermissions] = useState({
    cpCanViewAnalytics: true,
    cpCanExportLeads: false,
    customerCanEditEOI: true,
    requireAdminApproval: true,
  });

  const [saving, setSaving] = useState<string | null>(null);
  const [admins, setAdmins] = useState<Array<{ id: string; name: string; email: string; status: string }>>([]);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "" });
  const [templates, setTemplates] = useState<Array<{ type: string; subject: string; body: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/email-templates").then((r) => r.json()),
    ])
      .then(([data, users, tpls]) => {
        if (data.profile) setProfile((p) => ({ ...p, ...data.profile }));
        if (data.notifications) setNotifPrefs(data.notifications);
        if (data.eoiRules) setEoiRules(data.eoiRules);
        if (data.permissions) setPermissions(data.permissions);
        setAdmins(users || []);
        setTemplates(tpls || []);
        if (tpls?.[0]) setSelectedTemplate(tpls[0].type);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveSection = async (section: string) => {
    setSaving(section);
    try {
      const payload =
        section === "Profile" ? { profile: { name: profile.name, phone: profile.phone, supportEmail: profile.supportEmail } }
        : section === "Notifications" ? { notifications: notifPrefs }
        : section === "EOI Rules" ? { eoiRules }
        : { permissions };

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      addToast({ type: "success", title: "Settings saved", message: `${section} preferences updated successfully.` });
    } catch (e) {
      addToast({ type: "error", title: "Save failed", message: (e as Error).message });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="max-w-3xl space-y-6"><LoadingSkeleton rows={8} /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Manage your profile, notifications, EOI rules, and permissions"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#2563EB]" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Full Name" htmlFor="admin-name">
            <Input id="admin-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </FormField>
          <FormField label="Email" htmlFor="admin-email">
            <Input id="admin-email" type="email" value={profile.email} disabled />
          </FormField>
          <FormField label="Phone" htmlFor="admin-phone" hint="Include country code">
            <Input id="admin-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+91 98765 43210" />
          </FormField>
          <FormField label="Support Email" htmlFor="support-email" hint="Shown to partners for account issues">
            <Input id="support-email" type="email" value={profile.supportEmail} onChange={(e) => setProfile({ ...profile, supportEmail: e.target.value })} />
          </FormField>
          <Button loading={saving === "Profile"} onClick={() => saveSection("Profile")}>Save Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#2563EB]" /> Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "newEoi" as const, label: "New EOI submissions" },
            { key: "cpRegistration" as const, label: "Channel partner registrations" },
            { key: "approvalReminders" as const, label: "Pending approval reminders" },
            { key: "projectUpdates" as const, label: "Project status updates" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifPrefs[key]}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, [key]: e.target.checked })}
                className="h-4 w-4 rounded border-border text-[#2563EB] focus:ring-[#2563EB]/20"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
          <Select
            label="Email Digest Frequency"
            value={notifPrefs.emailDigest}
            onChange={(e) => setNotifPrefs({ ...notifPrefs, emailDigest: e.target.value })}
            options={[
              { value: "realtime", label: "Real-time" },
              { value: "daily", label: "Daily Digest" },
              { value: "weekly", label: "Weekly Digest" },
              { value: "none", label: "None" },
            ]}
          />
          <Button loading={saving === "Notifications"} onClick={() => saveSection("Notifications")}>Save Preferences</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#2563EB]" /> EOI Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={eoiRules.requireCheque}
              onChange={(e) => setEoiRules({ ...eoiRules, requireCheque: e.target.checked })}
              className="h-4 w-4 rounded border-border text-[#2563EB]"
            />
            <span className="text-sm text-foreground">Require cheque document upload</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={eoiRules.allowCorrections}
              onChange={(e) => setEoiRules({ ...eoiRules, allowCorrections: e.target.checked })}
              className="h-4 w-4 rounded border-border text-[#2563EB]"
            />
            <span className="text-sm text-foreground">Allow correction requests</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={eoiRules.autoReview}
              onChange={(e) => setEoiRules({ ...eoiRules, autoReview: e.target.checked })}
              className="h-4 w-4 rounded border-border text-[#2563EB]"
            />
            <span className="text-sm text-foreground">Auto-move submitted EOIs to under review</span>
          </label>
          <FormField label="Minimum EOI Deposit (₹)" htmlFor="min-deposit">
            <Input id="min-deposit" type="number" value={eoiRules.minDeposit} onChange={(e) => setEoiRules({ ...eoiRules, minDeposit: e.target.value })} />
          </FormField>
          <FormField label="Max Pending Days Before Reminder" htmlFor="max-pending">
            <Input id="max-pending" type="number" value={eoiRules.maxPendingDays} onChange={(e) => setEoiRules({ ...eoiRules, maxPendingDays: e.target.value })} />
          </FormField>
          <Button loading={saving === "EOI Rules"} onClick={() => saveSection("EOI Rules")}>Save EOI Rules</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#2563EB]" /> Permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "cpCanViewAnalytics" as const, label: "Channel partners can view analytics" },
            { key: "cpCanExportLeads" as const, label: "Channel partners can export leads" },
            { key: "customerCanEditEOI" as const, label: "Customers can edit draft EOIs" },
            { key: "requireAdminApproval" as const, label: "Require admin approval for all EOIs" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={permissions[key]}
                onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                className="h-4 w-4 rounded border-border text-[#2563EB]"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
          <Button loading={saving === "Permissions"} onClick={() => saveSection("Permissions")}>Save Permissions</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#2563EB]" /> Admin Users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{admin.name}</p>
                  <p className="text-muted-foreground">{admin.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{admin.status}</span>
                  {admin.status === "ACTIVE" && admin.email !== session?.user?.email && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={saving === `deactivate-${admin.id}`}
                      onClick={async () => {
                        setSaving(`deactivate-${admin.id}`);
                        try {
                          const res = await fetch(`/api/admin/users/${admin.id}`, { method: "PATCH" });
                          if (!res.ok) throw new Error("Failed to deactivate");
                          setAdmins((prev) => prev.map((a) => a.id === admin.id ? { ...a, status: "INACTIVE" } : a));
                          addToast({ type: "success", title: "Admin deactivated" });
                        } catch (e) {
                          addToast({ type: "error", title: "Failed", message: (e as Error).message });
                        } finally {
                          setSaving(null);
                        }
                      }}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Invite Admin</p>
            <Input label="Name" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
            <Input label="Email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
            <Input label="Temporary Password" type="password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} />
            <Button
              loading={saving === "invite"}
              onClick={async () => {
                setSaving("invite");
                try {
                  const res = await fetch("/api/admin/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(inviteForm),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Invite failed");
                  setAdmins((prev) => [data, ...prev]);
                  setInviteForm({ name: "", email: "", password: "" });
                  addToast({ type: "success", title: "Admin invited" });
                } catch (e) {
                  addToast({ type: "error", title: "Invite failed", message: (e as Error).message });
                } finally {
                  setSaving(null);
                }
              }}
            >
              Invite Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#2563EB]" /> Email Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Template"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            options={[
              { value: "", label: "Select template" },
              ...["CP_REGISTRATION_ACK", "CP_APPROVED", "CUSTOMER_CONFIRMATION", "EOI_INVITATION", "LEAD_ONLY_ACCEPTED", "EOI_SUBMITTED", "EOI_APPROVED", "EOI_REJECTED", "CORRECTION_REQUESTED", "CP_REGISTERED", "CUSTOMER_SUBMITTED_EOI", "CUSTOMER_REJECTED_CP"].map((t) => ({
                value: t,
                label: t.replace(/_/g, " "),
              })),
            ]}
          />
          {selectedTemplate && (() => {
            const tpl = templates.find((t) => t.type === selectedTemplate) || { type: selectedTemplate, subject: "", body: "" };
            return (
              <>
                <Input
                  label="Subject"
                  value={tpl.subject}
                  onChange={(e) => setTemplates((prev) => {
                    const existing = prev.find((t) => t.type === selectedTemplate);
                    if (existing) {
                      return prev.map((t) => t.type === selectedTemplate ? { ...t, subject: e.target.value } : t);
                    }
                    return [...prev, { type: selectedTemplate, subject: e.target.value, body: "" }];
                  })}
                  placeholder="Use {{customerName}}, {{projectName}}, etc."
                />
                <FormField label="Body (HTML)" htmlFor="template-body">
                  <textarea
                    id="template-body"
                    className="w-full min-h-[200px] rounded-md border border-border p-3 text-sm"
                    value={tpl.body}
                    onChange={(e) => setTemplates((prev) => {
                      const existing = prev.find((t) => t.type === selectedTemplate);
                      if (existing) {
                        return prev.map((t) => t.type === selectedTemplate ? { ...t, body: e.target.value } : t);
                      }
                      return [...prev, { type: selectedTemplate, subject: "", body: e.target.value }];
                    })}
                    placeholder="HTML with {{placeholders}}"
                  />
                </FormField>
                <Button
                  loading={saving === "template"}
                  onClick={async () => {
                    const current = templates.find((t) => t.type === selectedTemplate);
                    if (!current?.subject || !current?.body) {
                      addToast({ type: "error", title: "Subject and body required" });
                      return;
                    }
                    setSaving("template");
                    try {
                      const res = await fetch("/api/admin/email-templates", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(current),
                      });
                      if (!res.ok) throw new Error("Save failed");
                      addToast({ type: "success", title: "Template saved" });
                    } catch (e) {
                      addToast({ type: "error", title: "Save failed", message: (e as Error).message });
                    } finally {
                      setSaving(null);
                    }
                  }}
                >
                  Save Template
                </Button>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
