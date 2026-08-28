"use client";

import { useEffect, useState } from "react";
import {
  Button, Card, CardContent, CardHeader, CardTitle, DataTable, Input, Modal,
  PageHeader, Select, StatusBadge, useToast, LoadingSkeleton,
} from "@goyal/ui";
import { Plus, Users } from "lucide-react";

interface TeamMemberRow {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string | null;
  status: string;
  performance: {
    totalLeads: number;
    siteVisitsCompleted: number;
    booked: number;
    eoiSubmitted: number;
    eoiApproved: number;
    conversionRate: number;
  };
}

const emptyForm = { name: "", email: "", mobile: "", role: "FOS" };

export default function PartnerTeamPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/team");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load team");
      setMembers(data);
    } catch (e) {
      addToast({ type: "error", title: "Load failed", message: e instanceof Error ? e.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: TeamMemberRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      email: row.email || "",
      mobile: row.mobile || "",
      role: row.role || "FOS",
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/partner/team/${editing.id}` : "/api/partner/team";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      addToast({ type: "success", title: editing ? "Member updated" : "Member added" });
      setModalOpen(false);
      load();
    } catch (e) {
      addToast({ type: "error", title: "Save failed", message: e instanceof Error ? e.message : "Try again" });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (row: TeamMemberRow) => {
    if (!confirm(`Deactivate ${row.name}?`)) return;
    const res = await fetch(`/api/partner/team/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      addToast({ type: "error", title: "Failed", message: data.error });
      return;
    }
    addToast({ type: "success", title: "Member deactivated" });
    load();
  };

  const activeCount = members.filter((m) => m.status === "ACTIVE").length;
  const totalLeads = members.reduce((s, m) => s + m.performance.totalLeads, 0);
  const totalBooked = members.reduce((s, m) => s + m.performance.booked, 0);

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Team"
        description="Manage team members and track their lead performance"
        actions={
          <Button variant="gold" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active members</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{activeCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Team leads</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalLeads}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Team bookings</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalBooked}</p></CardContent>
        </Card>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name", render: (r: TeamMemberRow) => (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{r.name}</span>
            </div>
          )},
          { key: "role", header: "Role", render: (r: TeamMemberRow) => r.role || "—" },
          { key: "email", header: "Email", render: (r: TeamMemberRow) => r.email || "—" },
          { key: "leads", header: "Leads", render: (r: TeamMemberRow) => r.performance.totalLeads },
          { key: "sv", header: "Site visits", render: (r: TeamMemberRow) => r.performance.siteVisitsCompleted },
          { key: "booked", header: "Booked", render: (r: TeamMemberRow) => r.performance.booked },
          { key: "conv", header: "Conversion", render: (r: TeamMemberRow) => `${r.performance.conversionRate}%` },
          { key: "status", header: "Status", render: (r: TeamMemberRow) => (
            <StatusBadge status={r.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"} />
          )},
          { key: "actions", header: "", render: (r: TeamMemberRow) => (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
              {r.status === "ACTIVE" && (
                <Button variant="outline" size="sm" onClick={() => deactivate(r)}>Deactivate</Button>
              )}
            </div>
          )},
        ]}
        data={members}
        emptyTitle="No team members yet"
        emptyDescription="Add your first team member to track performance."
      />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit team member" : "Add team member"}
      >
        <div className="grid gap-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email (for notifications)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit mobile" />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: "FOS", label: "FOS" },
              { value: "Sales Executive", label: "Sales Executive" },
              { value: "Team Lead", label: "Team Lead" },
              { value: "Other", label: "Other" },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saving} onClick={save} disabled={form.name.trim().length < 2}>
              {editing ? "Save changes" : "Add member"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
