"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button, Card, CardContent, CardHeader, CardTitle, DataTable, Input, Modal,
  PageHeader, Select, StatusBadge, useToast, LoadingSkeleton,
} from "@goyal/ui";
import { Plus, Users } from "lucide-react";
import { useRequirePartnerAccess } from "@/lib/use-require-partner";

interface Performance {
  totalLeads: number;
  siteVisitsCompleted: number;
  booked: number;
  eoiSubmitted: number;
  eoiApproved: number;
  conversionRate: number;
}

interface TeamMemberRow {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string | null;
  jobRole: "SALES_EXECUTIVE" | "TEAM_LEADER";
  teamLeaderId: string | null;
  teamLeader?: { id: string; name: string } | null;
  directReports?: Array<{ id: string; name: string; status: string }>;
  status: string;
  performance: Performance;
  teamPerformance?: Performance | null;
}

interface TeamPayload {
  members: TeamMemberRow[];
  teams: Array<{
    leader: TeamMemberRow;
    members: TeamMemberRow[];
    performance: Performance | null;
  }>;
  unassignedExecutives: TeamMemberRow[];
  canManage: boolean;
}

const emptyForm = {
  name: "",
  email: "",
  mobile: "",
  jobRole: "SALES_EXECUTIVE" as "SALES_EXECUTIVE" | "TEAM_LEADER",
  teamLeaderId: "",
  memberIds: [] as string[],
};

export default function PartnerTeamPage() {
  const { addToast } = useToast();
  const { isOwner, allowed } = useRequirePartnerAccess({ teamPage: true });
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<TeamPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = Boolean(payload?.canManage && isOwner);
  const members = payload?.members || [];

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/team");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load team");
      setPayload(data);
    } catch (e) {
      addToast({ type: "error", title: "Load failed", message: e instanceof Error ? e.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

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
      jobRole: row.jobRole || "SALES_EXECUTIVE",
      teamLeaderId: row.teamLeaderId || "",
      memberIds: (row.directReports || []).map((r) => r.id),
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/partner/team/${editing.id}` : "/api/partner/team";
      const method = editing ? "PATCH" : "POST";
      const body =
        form.jobRole === "TEAM_LEADER"
          ? {
              name: form.name,
              email: form.email,
              mobile: form.mobile,
              jobRole: form.jobRole,
              memberIds: form.memberIds,
            }
          : {
              name: form.name,
              email: form.email,
              mobile: form.mobile,
              jobRole: form.jobRole,
              teamLeaderId: form.teamLeaderId || null,
            };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      addToast({
        type: "success",
        title: editing ? "Member updated" : "Member added",
        message: data.invited ? "A set-password email was sent to the team member." : undefined,
      });
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

  const leaders = useMemo(
    () => members.filter((m) => m.jobRole === "TEAM_LEADER" && m.status === "ACTIVE"),
    [members],
  );
  const executives = useMemo(
    () => members.filter((m) => m.jobRole === "SALES_EXECUTIVE" && m.status === "ACTIVE"),
    [members],
  );

  const activeCount = members.filter((m) => m.status === "ACTIVE").length;
  const totalLeads = members.reduce((s, m) => s + m.performance.totalLeads, 0);
  const totalBooked = members.reduce((s, m) => s + m.performance.booked, 0);

  if (!allowed) return <div className="min-h-screen bg-background" />;
  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Team"
        description={
          canManage
            ? "Manage Sales Executives and Team Leaders, and track team-wise performance"
            : "View your team performance"
        }
        actions={
          canManage ? (
            <Button variant="gold" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          ) : undefined
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

      {(payload?.teams || []).map((team) => (
        <Card key={team.leader.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {team.leader.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">Team Leader</span>
            </CardTitle>
            {team.performance && (
              <p className="text-sm text-muted-foreground">
                Team rollup — Leads {team.performance.totalLeads} · Site visits {team.performance.siteVisitsCompleted} · Booked {team.performance.booked} · Conv {team.performance.conversionRate}%
              </p>
            )}
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "name", header: "Member", render: (r: TeamMemberRow) => r.name },
                { key: "role", header: "Role", render: (r: TeamMemberRow) => (r.jobRole === "TEAM_LEADER" ? "Team Leader" : "Sales Executive") },
                { key: "leads", header: "Leads", render: (r: TeamMemberRow) => r.performance.totalLeads },
                { key: "sv", header: "Site visits", render: (r: TeamMemberRow) => r.performance.siteVisitsCompleted },
                { key: "booked", header: "Booked", render: (r: TeamMemberRow) => r.performance.booked },
                { key: "conv", header: "Conversion", render: (r: TeamMemberRow) => `${r.performance.conversionRate}%` },
              ]}
              data={[team.leader, ...team.members]}
              emptyTitle="No members on this team"
            />
          </CardContent>
        </Card>
      ))}

      {(payload?.unassignedExecutives?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unassigned Sales Executives</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "name", header: "Name", render: (r: TeamMemberRow) => r.name },
                { key: "leads", header: "Leads", render: (r: TeamMemberRow) => r.performance.totalLeads },
                { key: "booked", header: "Booked", render: (r: TeamMemberRow) => r.performance.booked },
                { key: "conv", header: "Conversion", render: (r: TeamMemberRow) => `${r.performance.conversionRate}%` },
              ]}
              data={payload!.unassignedExecutives}
            />
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={[
          { key: "name", header: "Name", render: (r: TeamMemberRow) => (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{r.name}</span>
            </div>
          )},
          {
            key: "role",
            header: "Role",
            render: (r: TeamMemberRow) => (r.jobRole === "TEAM_LEADER" ? "Team Leader" : "Sales Executive"),
          },
          {
            key: "leader",
            header: "Team Leader",
            render: (r: TeamMemberRow) => r.teamLeader?.name || (r.jobRole === "TEAM_LEADER" ? "—" : "Unassigned"),
          },
          { key: "email", header: "Email", render: (r: TeamMemberRow) => r.email || "—" },
          { key: "leads", header: "Leads", render: (r: TeamMemberRow) => r.performance.totalLeads },
          { key: "sv", header: "Site visits", render: (r: TeamMemberRow) => r.performance.siteVisitsCompleted },
          { key: "booked", header: "Booked", render: (r: TeamMemberRow) => r.performance.booked },
          { key: "conv", header: "Conversion", render: (r: TeamMemberRow) => `${r.performance.conversionRate}%` },
          { key: "status", header: "Status", render: (r: TeamMemberRow) => (
            <StatusBadge status={r.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"} />
          )},
          ...(canManage
            ? [{
                key: "actions",
                header: "",
                render: (r: TeamMemberRow) => (
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                    {r.status === "ACTIVE" && (
                      <Button variant="outline" size="sm" onClick={() => deactivate(r)}>Deactivate</Button>
                    )}
                  </div>
                ),
              }]
            : []),
        ]}
        data={members}
        emptyTitle="No team members yet"
        emptyDescription={canManage ? "Add your first team member to track performance." : "No team members in your scope."}
      />

      {canManage && (
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={editing ? "Edit team member" : "Add team member"}
        >
          <div className="grid gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email (login invite)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit mobile" />
            <Select
              label="Role"
              value={form.jobRole}
              onChange={(e) =>
                setForm({
                  ...form,
                  jobRole: e.target.value as "SALES_EXECUTIVE" | "TEAM_LEADER",
                  teamLeaderId: "",
                  memberIds: [],
                })
              }
              options={[
                { value: "SALES_EXECUTIVE", label: "Sales Executive" },
                { value: "TEAM_LEADER", label: "Team Leader" },
              ]}
            />
            {form.jobRole === "SALES_EXECUTIVE" && (
              <Select
                label="Team Leader (optional)"
                value={form.teamLeaderId}
                onChange={(e) => setForm({ ...form, teamLeaderId: e.target.value })}
                options={[
                  { value: "", label: "No team leader" },
                  ...leaders
                    .filter((l) => !editing || l.id !== editing.id)
                    .map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
            )}
            {form.jobRole === "TEAM_LEADER" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Team members (optional)</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {executives
                    .filter((e) => !editing || e.id !== editing.id)
                    .map((exec) => {
                      const checked = form.memberIds.includes(exec.id);
                      return (
                        <label key={exec.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) => {
                              setForm({
                                ...form,
                                memberIds: ev.target.checked
                                  ? [...form.memberIds, exec.id]
                                  : form.memberIds.filter((id) => id !== exec.id),
                              });
                            }}
                          />
                          {exec.name}
                        </label>
                      );
                    })}
                  {executives.length === 0 && (
                    <p className="text-xs text-muted-foreground">No sales executives yet.</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="gold" loading={saving} onClick={save} disabled={form.name.trim().length < 2}>
                {editing ? "Save changes" : "Add member"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
