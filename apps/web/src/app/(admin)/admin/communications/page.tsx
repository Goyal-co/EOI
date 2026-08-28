"use client";

import { useEffect, useState } from "react";
import {
  Button, Card, DataTable, Input, Modal, PageHeader, Select, StatusBadge, Textarea, useToast, LoadingSkeleton,
} from "@goyal/ui";
import { Megaphone, Paperclip, Send } from "lucide-react";
import { useAdminProjects } from "@/lib/hooks";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  channels: string[];
  status: string;
  priority: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  project: { id: string; name: string } | null;
  attachments: Array<{ id: string; fileName: string; fileUrl: string; kind: string }>;
  _count: { deliveries: number };
}

const AUDIENCE_OPTIONS = [
  { value: "ALL", label: "All users" },
  { value: "ADMINS", label: "Admins" },
  { value: "CHANNEL_PARTNERS", label: "Channel Partners" },
  { value: "CUSTOMERS", label: "Customers" },
  { value: "PROJECT_CPS", label: "CPs (project)" },
  { value: "PROJECT_CUSTOMERS", label: "Customers (project)" },
];

const emptyForm = {
  title: "",
  body: "",
  audience: "CHANNEL_PARTNERS",
  channels: ["IN_APP"] as string[],
  projectId: "",
  priority: "MEDIUM",
  scheduledAt: "",
};

export default function AdminCommunicationsPage() {
  const { addToast } = useToast();
  const { data: projects = [] } = useAdminProjects();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data);
    } catch (e) {
      addToast({ type: "error", title: "Load failed", message: e instanceof Error ? e.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setDraftId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: AnnouncementRow) => {
    setEditing(row);
    setDraftId(row.id);
    setForm({
      title: row.title,
      body: row.body,
      audience: row.audience,
      channels: row.channels,
      projectId: row.project?.id || "",
      priority: row.priority,
      scheduledAt: row.scheduledAt ? row.scheduledAt.slice(0, 16) : "",
    });
    setModalOpen(true);
  };

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter((c) => c !== ch)
        : [...f.channels, ch],
    }));
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        projectId: form.projectId || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        channels: form.channels as ("IN_APP" | "EMAIL")[],
      };
      const url = editing ? `/api/admin/announcements/${editing.id}` : "/api/admin/announcements";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraftId(data.id);
      setEditing(data);
      addToast({ type: "success", title: "Draft saved" });
      load();
    } catch (e) {
      addToast({ type: "error", title: "Save failed", message: e instanceof Error ? e.message : "Try again" });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File) => {
    const id = draftId || editing?.id;
    if (!id) {
      addToast({ type: "warning", title: "Save draft first", message: "Save the announcement before uploading files." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/announcements/${id}/attachments`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast({ type: "success", title: "Attachment added" });
      load();
      if (editing) {
        const detail = await fetch(`/api/admin/announcements/${id}`).then((r) => r.json());
        setEditing(detail);
      }
    } catch (e) {
      addToast({ type: "error", title: "Upload failed", message: e instanceof Error ? e.message : "Try again" });
    } finally {
      setUploading(false);
    }
  };

  const publish = async (id: string) => {
    if (!confirm("Publish this announcement now?")) return;
    const res = await fetch(`/api/admin/announcements/${id}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      addToast({ type: "error", title: "Publish failed", message: data.error });
      return;
    }
    addToast({ type: "success", title: "Published", message: `Delivered to ${data.recipients || 0} recipients` });
    setModalOpen(false);
    load();
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  const attachments = editing?.attachments || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        description="Create announcements for CPs, customers, or admins with in-app and email delivery"
        actions={
          <Button variant="gold" onClick={openCreate}>
            <Megaphone className="h-4 w-4 mr-2" />
            New announcement
          </Button>
        }
      />

      <DataTable
        columns={[
          { key: "title", header: "Title", render: (r: AnnouncementRow) => r.title },
          { key: "audience", header: "Audience", render: (r: AnnouncementRow) => r.audience.replace(/_/g, " ") },
          { key: "channels", header: "Channels", render: (r: AnnouncementRow) => r.channels.join(", ") },
          { key: "status", header: "Status", render: (r: AnnouncementRow) => <StatusBadge status={r.status} /> },
          { key: "deliveries", header: "Deliveries", render: (r: AnnouncementRow) => r._count.deliveries },
          { key: "actions", header: "", render: (r: AnnouncementRow) => (
            <div className="flex gap-2 justify-end">
              {r.status !== "PUBLISHED" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                  <Button variant="gold" size="sm" onClick={() => publish(r.id)}>
                    <Send className="h-3 w-3 mr-1" />Publish
                  </Button>
                </>
              )}
            </div>
          )},
        ]}
        data={rows}
        emptyTitle="No announcements yet."
      />

      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit announcement" : "New announcement"} size="lg">
        <div className="grid gap-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Message" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Select
            label="Audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            options={AUDIENCE_OPTIONS}
          />
          {(form.audience === "PROJECT_CPS" || form.audience === "PROJECT_CUSTOMERS") && (
            <Select
              label="Project"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              options={[
                { value: "", label: "Select project…" },
                ...projects.map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })),
              ]}
            />
          )}
          <Select
            label="Priority"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={[
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
              { value: "CRITICAL", label: "Critical" },
            ]}
          />
          <Input
            label="Schedule (optional)"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          />
          <div>
            <p className="text-sm font-medium mb-2">Delivery channels</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.channels.includes("IN_APP")} onChange={() => toggleChannel("IN_APP")} />
                In-app notification
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.channels.includes("EMAIL")} onChange={() => toggleChannel("EMAIL")} />
                Email
              </label>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Attachments</p>
            {attachments.length > 0 && (
              <ul className="text-sm text-muted-foreground mb-2 space-y-1">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <Paperclip className="h-3 w-3" />{a.fileName}
                  </li>
                ))}
              </ul>
            )}
            <Input
              type="file"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="outline" loading={saving} onClick={saveDraft}>Save draft</Button>
            {(draftId || editing?.id) && (
              <Button variant="gold" onClick={() => publish(draftId || editing!.id)}>
                Publish now
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
