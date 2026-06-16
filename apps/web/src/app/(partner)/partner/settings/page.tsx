"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, useToast, PageHeader, LoadingSkeleton, cn } from "@goyal/ui";
import { Bell, Mail, Shield, Eye } from "lucide-react";

interface ToggleProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingToggle({ label, description, icon, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-border"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

interface Settings {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  pushNotifications: boolean;
  eoiUpdates: boolean;
  leadAlerts: boolean;
  profileVisible: boolean;
  shareAnalytics: boolean;
}

const DEFAULTS: Settings = {
  emailNotifications: true,
  inAppNotifications: true,
  pushNotifications: true,
  eoiUpdates: true,
  leadAlerts: true,
  profileVisible: true,
  shareAnalytics: false,
};

export default function PartnerSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetch("/api/partner/settings")
      .then((r) => r.json())
      .then((data) => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => addToast({ type: "error", title: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, [addToast]);

  const update = (key: keyof Settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/partner/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settings");
      }
      const data = await res.json();
      setSettings({ ...DEFAULTS, ...data });
      addToast({ type: "success", title: "Settings saved", message: "Your preferences have been updated" });
    } catch (e) {
      addToast({ type: "error", title: "Save failed", message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-2xl space-y-6"><LoadingSkeleton rows={6} /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage notification and privacy preferences"
      />

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingToggle
            label="Email Notifications"
            description="Receive updates via email"
            icon={<Mail className="h-4 w-4" />}
            checked={settings.emailNotifications}
            onChange={(v) => update("emailNotifications", v)}
          />
          <SettingToggle
            label="In-App Notifications"
            description="Show alerts in the notification bell"
            icon={<Bell className="h-4 w-4" />}
            checked={settings.inAppNotifications}
            onChange={(v) => update("inAppNotifications", v)}
          />
          <SettingToggle
            label="Push Notifications"
            description="Browser push for urgent updates (bell alerts use this until Web Push is enabled)"
            icon={<Bell className="h-4 w-4" />}
            checked={settings.pushNotifications}
            onChange={(v) => update("pushNotifications", v)}
          />
          <SettingToggle
            label="EOI Status Updates"
            description="Get notified when EOI status changes"
            icon={<Bell className="h-4 w-4" />}
            checked={settings.eoiUpdates}
            onChange={(v) => update("eoiUpdates", v)}
          />
          <SettingToggle
            label="New Lead Alerts"
            description="Alerts when customers respond to invites"
            icon={<Bell className="h-4 w-4" />}
            checked={settings.leadAlerts}
            onChange={(v) => update("leadAlerts", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingToggle
            label="Profile Visibility"
            description="Allow admin to view your profile details"
            icon={<Eye className="h-4 w-4" />}
            checked={settings.profileVisible}
            onChange={(v) => update("profileVisible", v)}
          />
          <SettingToggle
            label="Share Analytics"
            description="Share anonymized performance data for benchmarking"
            icon={<Shield className="h-4 w-4" />}
            checked={settings.shareAnalytics}
            onChange={(v) => update("shareAnalytics", v)}
          />
        </CardContent>
      </Card>

      <Button variant="gold" onClick={handleSave} loading={saving}>
        Save Settings
      </Button>
    </div>
  );
}
