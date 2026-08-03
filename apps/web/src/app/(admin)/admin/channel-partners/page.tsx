"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DataTable, StatusBadge, Button, Drawer, Card, Modal, useToast, Textarea, PageHeader,
} from "@goyal/ui";
import { Eye, CheckCircle, Ban, ExternalLink, Download, FileText } from "lucide-react";
import { useAdminCPs, useAdminProjects } from "@/lib/hooks";
import {
  openPresignedAsset,
  getPresignedUrlForPreview,
  isImageFileName,
  isPdfFileName,
} from "@/lib/files/open-asset";

interface ChannelPartner {
  id: string;
  name: string;
  email: string;
  companyName: string;
  reraNumber: string;
  mobile: string;
  registeredLeads: number;
  submittedEOIs: number;
  approvedEOIs: number;
  closures: number;
  status: string;
  city: string;
  createdAt: string;
}

interface CPDocument {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
}

interface CPProfile {
  id: string;
  companyName: string;
  reraNumber: string;
  panNumber?: string | null;
  gstNumber?: string | null;
  city: string;
  status: string;
  user: { name: string; email: string; status: string };
  documents?: CPDocument[];
  projectAccess?: { projectId: string; project: { id: string; name: string } }[];
  performance: {
    totalLeads: number;
    totalEOIs: number;
    approvedEOIs: number;
    approvalRatio: number;
    projectWise: Record<string, number>;
  };
}

interface Project {
  id: string;
  name: string;
}

type TabFilter = "all" | "pending";

function isDocImage(doc: CPDocument): boolean {
  if (doc.mimeType?.startsWith("image/")) return true;
  return isImageFileName(doc.fileName) || isImageFileName(doc.fileUrl);
}

function isDocPdf(doc: CPDocument): boolean {
  if (doc.mimeType === "application/pdf") return true;
  return isPdfFileName(doc.fileName) || isPdfFileName(doc.fileUrl);
}

function DocumentPreviewCard({
  doc,
  label,
}: {
  doc: CPDocument;
  label: string;
}) {
  const apiPath = `/api/admin/documents/${doc.id}/download`;
  const showImage = isDocImage(doc);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!showImage) return;
    let cancelled = false;
    setImgSrc(null);
    setImgError(false);
    getPresignedUrlForPreview(apiPath)
      .then((url) => {
        if (!cancelled) setImgSrc(url);
      })
      .catch(() => {
        if (!cancelled) setImgSrc(doc.fileUrl || null);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, doc.fileUrl, showImage]);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath)}>
            <ExternalLink className="h-3.5 w-3.5" />
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openPresignedAsset(apiPath)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {showImage && !imgError ? (
        <button
          type="button"
          onClick={() => openPresignedAsset(apiPath)}
          className="block w-full text-left bg-muted/40"
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={label}
              className="w-full max-h-72 object-contain bg-[#f3f4f6]"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="h-40 w-full animate-pulse bg-muted" />
          )}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-3 py-4 text-sm text-muted-foreground">
          <FileText className="h-8 w-8 shrink-0 opacity-60" />
          <span>{isDocPdf(doc) ? "PDF document — open to review" : "File attached — open to review"}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminChannelPartnersPage() {
  const { data, isLoading } = useAdminCPs();
  const { data: projectsData } = useAdminProjects();
  const allCps = (data as ChannelPartner[]) || [];
  const projects = (projectsData as Project[]) || [];
  const qc = useQueryClient();
  const { addToast } = useToast();

  const [tab, setTab] = useState<TabFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState<CPProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [cpToApprove, setCpToApprove] = useState<ChannelPartner | null>(null);
  const [approveDocs, setApproveDocs] = useState<CPDocument[]>([]);
  const [loadingApproveDocs, setLoadingApproveDocs] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [cpToBlock, setCpToBlock] = useState<ChannelPartner | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [cpToAssign, setCpToAssign] = useState<CPProfile | null>(null);

  const cps = useMemo(() => {
    if (tab === "pending") return allCps.filter((cp) => cp.status === "PENDING");
    return allCps;
  }, [allCps, tab]);

  const viewProfile = async (cp: ChannelPartner) => {
    setDrawerOpen(true);
    setLoadingProfile(true);
    setProfile(null);
    try {
      const res = await fetch(`/api/admin/channel-partners/${cp.id}`);
      if (!res.ok) throw new Error("Failed to load profile");
      setProfile(await res.json());
    } catch (e) {
      addToast({ type: "error", title: "Failed to load profile", message: (e as Error).message });
      setDrawerOpen(false);
    } finally {
      setLoadingProfile(false);
    }
  };

  const openApproveModal = async (cp: ChannelPartner) => {
    setCpToApprove(cp);
    setSelectedProjectIds([]);
    setApproveDocs([]);
    setApproveModalOpen(true);
    setLoadingApproveDocs(true);
    try {
      const res = await fetch(`/api/admin/channel-partners/${cp.id}`);
      if (res.ok) {
        const data = await res.json();
        setApproveDocs(data.documents || []);
      }
    } catch {
      // non-blocking — approve can continue without docs preview
    } finally {
      setLoadingApproveDocs(false);
    }
  };

  const docLabel = (type: string) => {
    const labels: Record<string, string> = {
      RERA_CERT: "RERA Certificate",
      PAN: "PAN Document",
      CHEQUE: "Cancelled Cheque",
      GST_CERT: "GST Certificate",
      VISITING_CARD: "Visiting Card",
    };
    return labels[type] || type.replace(/_/g, " ");
  };

  const DocumentsList = ({ docs, emptyText }: { docs: CPDocument[]; emptyText: string }) => {
    if (docs.length === 0) {
      return <p className="text-sm text-muted-foreground">{emptyText}</p>;
    }
    return (
      <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
        {docs.map((doc) => (
          <DocumentPreviewCard key={doc.id} doc={doc} label={docLabel(doc.type)} />
        ))}
      </div>
    );
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  const allProjectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const allSelected = projects.length > 0 && selectedProjectIds.length === projects.length;

  const selectAllProjects = () => setSelectedProjectIds(allProjectIds);
  const clearAllProjects = () => setSelectedProjectIds([]);

  const projectSelectionHeader = (
    <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => (allSelected ? clearAllProjects() : selectAllProjects())}
          className="rounded"
        />
        {allSelected ? "Clear all" : "Select all"}
      </label>
      <span className="text-xs text-muted-foreground">
        {selectedProjectIds.length} of {projects.length} selected
      </span>
    </div>
  );

  const handleApprove = async () => {
    if (!cpToApprove) return;
    setActionLoading(cpToApprove.id);
    try {
      const res = await fetch(`/api/admin/channel-partners/${cpToApprove.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", projectIds: selectedProjectIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve partner");
      }
      await qc.invalidateQueries({ queryKey: ["admin", "cps"] });
      addToast({
        type: "success",
        title: "Partner approved",
        message: `${cpToApprove.name} has been approved.`,
      });
      setApproveModalOpen(false);
      setCpToApprove(null);
    } catch (e) {
      addToast({ type: "error", title: "Action failed", message: (e as Error).message });
    } finally {
      setActionLoading(null);
    }
  };

  const openAssignProjectsModal = (cpProfile: CPProfile) => {
    setCpToAssign(cpProfile);
    setSelectedProjectIds(cpProfile.projectAccess?.map((a) => a.projectId) ?? []);
    setAssignModalOpen(true);
  };

  const handleAssignProjects = async () => {
    if (!cpToAssign) return;
    setActionLoading(cpToAssign.id);
    try {
      const res = await fetch(`/api/admin/channel-partners/${cpToAssign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: selectedProjectIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign projects");
      }
      await qc.invalidateQueries({ queryKey: ["admin", "cps"] });
      const refreshed = await fetch(`/api/admin/channel-partners/${cpToAssign.id}`);
      if (refreshed.ok) setProfile(await refreshed.json());
      addToast({
        type: "success",
        title: "Projects updated",
        message: `Project access updated for ${cpToAssign.user.name}.`,
      });
      setAssignModalOpen(false);
      setCpToAssign(null);
    } catch (e) {
      addToast({ type: "error", title: "Action failed", message: (e as Error).message });
    } finally {
      setActionLoading(null);
    }
  };

  const openBlockModal = (cp: ChannelPartner) => {
    setCpToBlock(cp);
    setBlockReason("");
    setBlockModalOpen(true);
  };

  const handleBlock = async () => {
    if (!cpToBlock || !blockReason.trim()) return;
    setActionLoading(cpToBlock.id);
    try {
      const res = await fetch(`/api/admin/channel-partners/${cpToBlock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "BLOCKED", blockReason: blockReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to block partner");
      }
      await qc.invalidateQueries({ queryKey: ["admin", "cps"] });
      addToast({
        type: "success",
        title: "Partner blocked",
        message: `${cpToBlock.name} has been blocked.`,
      });
      setBlockModalOpen(false);
      setCpToBlock(null);
    } catch (e) {
      addToast({ type: "error", title: "Action failed", message: (e as Error).message });
    } finally {
      setActionLoading(null);
    }
  };

  const updateStatus = async (cp: ChannelPartner, status: "BLOCKED") => {
    openBlockModal(cp);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Channel Partners"
        description="Review, approve, and manage channel partner accounts"
        breadcrumb={[
          { label: "Dashboard", href: "/admin" },
          { label: "Channel Partners" },
          ...(profile ? [{ label: profile.user.name }] : []),
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open("/api/admin/export?type=cps&format=csv", "_blank")}>
            Export CSV
          </Button>
        }
      />

      <div className="flex gap-2">
        <Button
          variant={tab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("all")}
        >
          All
        </Button>
        <Button
          variant={tab === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("pending")}
        >
          Pending
        </Button>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "companyName", header: "Company" },
          { key: "reraNumber", header: "RERA No." },
          { key: "city", header: "City" },
          { key: "registeredLeads", header: "Leads" },
          { key: "submittedEOIs", header: "EOIs" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as string} /> },
        ]}
        data={cps}
        loading={isLoading}
        emptyTitle={tab === "pending" ? "No pending partners" : "No channel partners"}
        emptyDescription="Channel partners will appear here once they register."
        actions={(row) => {
          const cp = row as ChannelPartner;
          return (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => viewProfile(cp)}>
                <Eye className="h-4 w-4" />
              </Button>
              {cp.status !== "APPROVED" && cp.status !== "BLOCKED" && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={actionLoading === cp.id}
                  onClick={() => openApproveModal(cp)}
                >
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </Button>
              )}
              {cp.status !== "BLOCKED" && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={actionLoading === cp.id}
                  onClick={() => updateStatus(cp, "BLOCKED")}
                >
                  <Ban className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          );
        }}
      />

      <Modal
        open={approveModalOpen}
        onOpenChange={(open) => {
          setApproveModalOpen(open);
          if (!open) setCpToApprove(null);
        }}
        title="Approve Channel Partner"
        description={cpToApprove ? `Review documents and assign projects for ${cpToApprove.name}` : undefined}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Registration Documents</h4>
            {loadingApproveDocs ? (
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            ) : (
              <DocumentsList docs={approveDocs} emptyText="No documents uploaded with this registration." />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Select the projects this partner can access. You can change assignments later.
          </p>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active projects available.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projectSelectionHeader}
              {projects.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-blue-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-foreground">{project.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>Cancel</Button>
            <Button
              variant="gold"
              loading={actionLoading === cpToApprove?.id}
              onClick={handleApprove}
              disabled={selectedProjectIds.length === 0}
            >
              Approve Partner
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={blockModalOpen}
        onOpenChange={(open) => {
          setBlockModalOpen(open);
          if (!open) setCpToBlock(null);
        }}
        title="Block Channel Partner"
        description={cpToBlock ? `Block ${cpToBlock.name}? They will lose portal access.` : undefined}
        size="md"
      >
        <div className="space-y-4">
          <Textarea
            label="Block Reason"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            rows={3}
            placeholder="Enter reason for blocking this partner..."
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setBlockModalOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={actionLoading === cpToBlock?.id}
              onClick={handleBlock}
              disabled={blockReason.trim().length < 3}
            >
              Block Partner
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={assignModalOpen}
        onOpenChange={(open) => {
          setAssignModalOpen(open);
          if (!open) setCpToAssign(null);
        }}
        title="Manage Project Access"
        description={cpToAssign ? `Assign projects to ${cpToAssign.user.name}` : undefined}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the projects this partner can access. Unchecking a project removes their access.
          </p>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active projects available.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projectSelectionHeader}
              {projects.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-blue-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-foreground">{project.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button
              variant="gold"
              loading={actionLoading === cpToAssign?.id}
              onClick={handleAssignProjects}
              disabled={selectedProjectIds.length === 0}
            >
              Save Projects
            </Button>
          </div>
        </div>
      </Modal>

      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setProfile(null); }}
        title="Channel Partner Profile"
      >
        {loadingProfile ? (
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        ) : profile ? (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold text-foreground">{profile.user.name}</h3>
              <p className="text-sm text-muted-foreground">{profile.user.email}</p>
              <div className="mt-2"><StatusBadge status={profile.status} /></div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{profile.performance.totalLeads}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{profile.performance.totalEOIs}</p>
                <p className="text-xs text-muted-foreground">Total EOIs</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{profile.performance.approvedEOIs}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-[#2563EB]">{profile.performance.approvalRatio}%</p>
                <p className="text-xs text-muted-foreground">Approval Rate</p>
              </Card>
            </div>

            <Card className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">Company Details</h4>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Company</dt><dd>{profile.companyName || "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">RERA</dt><dd>{profile.reraNumber}</dd></div>
                {profile.panNumber && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">PAN</dt><dd>{profile.panNumber}</dd></div>
                )}
                {profile.gstNumber && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">GST</dt><dd>{profile.gstNumber}</dd></div>
                )}
                {profile.city && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">City</dt><dd>{profile.city}</dd></div>
                )}
              </dl>
            </Card>

            <Card className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">Uploaded Documents</h4>
              <DocumentsList
                docs={profile.documents || []}
                emptyText="No documents uploaded."
              />
            </Card>

            {Object.keys(profile.performance.projectWise).length > 0 && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">EOIs by Project</h4>
                {Object.entries(profile.performance.projectWise).map(([project, count]) => (
                  <div key={project} className="flex justify-between text-sm py-1 border-b border-border/60 last:border-0">
                    <span className="text-muted-foreground">{project}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </Card>
            )}

            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-foreground">Assigned Projects</h4>
                {profile.status === "APPROVED" && (
                  <Button variant="outline" size="sm" onClick={() => openAssignProjectsModal(profile)}>
                    Manage Projects
                  </Button>
                )}
              </div>
              {(profile.projectAccess?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No projects assigned yet.</p>
              ) : (
                <ul className="space-y-1">
                  {profile.projectAccess!.map((access) => (
                    <li key={access.projectId} className="text-sm text-foreground">
                      {access.project.name}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
