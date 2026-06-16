"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DataTable, StatusBadge, Button, Modal, Input, Select, Textarea, useToast, PageHeader, FormField, FileUpload,
} from "@goyal/ui";
import type { UploadedFile } from "@goyal/ui";
import { Plus, Pencil, Trash2, X, FolderOpen } from "lucide-react";
import { useAdminProjects } from "@/lib/hooks";
import type { DocumentType } from "@goyal/types";
import { uploadViaPresign } from "@/lib/uploads/client-upload";

interface Project {
  id: string;
  name: string;
  location: string;
  status: string;
  eoiStatus: string;
  startingPrice: number;
  possessionDate: string;
  eoiCount: number;
  activeCPs: number;
  closures: number;
  createdAt: string;
}

interface ProjectAsset {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
}

const ASSET_TYPES: { type: DocumentType; label: string }[] = [
  { type: "BROCHURE", label: "Brochure" },
  { type: "FLOOR_PLAN", label: "Floor Plan" },
  { type: "COST_SHEET", label: "Cost Sheet" },
  { type: "GALLERY", label: "Gallery Image" },
  { type: "BANNER", label: "Banner" },
];

const emptyForm = {
  name: "",
  location: "",
  startingPrice: "",
  possessionDate: "",
  description: "",
  eoiStatus: "OPEN",
  status: "ACTIVE",
  amenities: [] as string[],
  amenityInput: "",
  faqs: [] as Array<{ question: string; answer: string }>,
  eoiRule: { minBudget: "", requiredDocuments: [] as string[], docInput: "" },
};

export default function AdminProjectsPage() {
  const { data, isLoading } = useAdminProjects();
  const projects = (data as Project[]) || [];
  const qc = useQueryClient();
  const { addToast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadedFile | null>>({});

  const openEdit = async (project: Project) => {
    setSelected(project);
    setEditOpen(true);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`);
      if (!res.ok) throw new Error("Failed to load project");
      const full = await res.json();
      const rule = full.eoiRules?.[0];
      setForm({
        name: full.name,
        location: full.location,
        startingPrice: String(full.startingPrice),
        possessionDate: full.possessionDate ? new Date(full.possessionDate).toISOString().split("T")[0] : "",
        description: full.description || "",
        eoiStatus: full.eoiStatus,
        status: full.status,
        amenities: full.amenities || [],
        amenityInput: "",
        faqs: (full.faqs as Array<{ question: string; answer: string }> | null) || [],
        eoiRule: {
          minBudget: rule?.minBudget ? String(rule.minBudget) : "",
          requiredDocuments: rule?.requiredDocuments || [],
          docInput: "",
        },
      });
    } catch (e) {
      addToast({ type: "error", title: "Load failed", message: (e as Error).message });
      setEditOpen(false);
    }
  };

  const openAssets = async (project: Project) => {
    setSelected(project);
    setAssetsOpen(true);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/assets`);
      if (!res.ok) throw new Error("Failed to load assets");
      setAssets(await res.json());
    } catch (e) {
      addToast({ type: "error", title: "Load failed", message: (e as Error).message });
      setAssetsOpen(false);
    }
  };

  const openDelete = (project: Project) => {
    setSelected(project);
    setDeleteOpen(true);
  };

  const handleSave = async (isEdit: boolean) => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        location: form.location,
        startingPrice: Number(form.startingPrice),
        possessionDate: form.possessionDate,
        description: form.description || undefined,
        eoiStatus: form.eoiStatus,
        status: form.status,
        amenities: form.amenities,
        faqs: form.faqs.filter((f) => f.question.trim() && f.answer.trim()),
        eoiRule: {
          minBudget: form.eoiRule.minBudget ? Number(form.eoiRule.minBudget) : undefined,
          requiredDocuments: form.eoiRule.requiredDocuments,
        },
      };

      const res = await fetch(isEdit ? `/api/admin/projects/${selected!.id}` : "/api/admin/projects", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save project");
      }

      await qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      addToast({ type: "success", title: isEdit ? "Project updated" : "Project created" });
      setAddOpen(false);
      setEditOpen(false);
      setForm(emptyForm);
      setSelected(null);
    } catch (e) {
      addToast({ type: "error", title: "Save failed", message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/projects/${selected.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      await qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      addToast({ type: "success", title: "Project deleted" });
      setDeleteOpen(false);
      setSelected(null);
    } catch (e) {
      addToast({ type: "error", title: "Delete failed", message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleAssetUpload = async (type: DocumentType, file: File) => {
    if (!selected) return;
    setUploads((prev) => ({
      ...prev,
      [type]: { name: file.name, size: file.size, status: "uploading", progress: 0 },
    }));

    try {
      const uploaded = await uploadViaPresign(file, type);

      const assetRes = await fetch(`/api/admin/projects/${selected.id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          fileSize: uploaded.fileSize,
        }),
      });
      if (!assetRes.ok) throw new Error("Failed to save asset");

      const asset = await assetRes.json();
      setAssets((prev) => [asset, ...prev]);
      setUploads((prev) => ({ ...prev, [type]: { name: file.name, size: file.size, status: "success", progress: 100 } }));
      addToast({ type: "success", title: "Asset uploaded" });
    } catch (e) {
      setUploads((prev) => ({ ...prev, [type]: { name: file.name, size: file.size, status: "error", progress: 0 } }));
      addToast({ type: "error", title: "Upload failed", message: (e as Error).message });
    }
  };

  const handleAssetDelete = async (assetId: string) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/projects/${selected.id}/assets?assetId=${assetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      addToast({ type: "success", title: "Asset removed" });
    } catch (e) {
      addToast({ type: "error", title: "Delete failed", message: (e as Error).message });
    }
  };

  const formFields = (
    <div className="space-y-4">
      <FormField label="Project Name" required htmlFor="project-name">
        <Input id="project-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </FormField>
      <FormField label="Location" required htmlFor="project-location">
        <Input id="project-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
      </FormField>
      <FormField label="Starting Price (₹)" required htmlFor="project-price">
        <Input id="project-price" type="number" value={form.startingPrice} onChange={(e) => setForm({ ...form, startingPrice: e.target.value })} required />
      </FormField>
      <FormField label="Possession Date" required htmlFor="project-possession">
        <Input id="project-possession" type="date" value={form.possessionDate} onChange={(e) => setForm({ ...form, possessionDate: e.target.value })} required />
      </FormField>
      <FormField label="EOI Status" htmlFor="project-eoi-status">
        <Select
          id="project-eoi-status"
          value={form.eoiStatus}
          onChange={(e) => setForm({ ...form, eoiStatus: e.target.value })}
          options={[
            { value: "OPEN", label: "EOI Open" },
            { value: "CLOSED", label: "EOI Closed" },
          ]}
        />
      </FormField>
      <FormField label="Project Status" htmlFor="project-status">
        <Select
          id="project-status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
            { value: "UPCOMING", label: "Upcoming" },
          ]}
        />
      </FormField>
      <FormField label="Description" htmlFor="project-description">
        <Textarea id="project-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </FormField>

      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">Amenities</span>
        <div className="flex gap-2">
          <Input
            value={form.amenityInput}
            onChange={(e) => setForm({ ...form, amenityInput: e.target.value })}
            placeholder="Add amenity"
            onKeyDown={(e) => {
              if (e.key === "Enter" && form.amenityInput.trim()) {
                e.preventDefault();
                setForm({
                  ...form,
                  amenities: [...form.amenities, form.amenityInput.trim()],
                  amenityInput: "",
                });
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!form.amenityInput.trim()) return;
              setForm({
                ...form,
                amenities: [...form.amenities, form.amenityInput.trim()],
                amenityInput: "",
              });
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.amenities.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs">
              {a}
              <button type="button" onClick={() => setForm({ ...form, amenities: form.amenities.filter((x) => x !== a) })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <span className="text-sm font-medium text-foreground">Per-Project EOI Rules</span>
        <FormField label="Minimum Budget (₹)" htmlFor="min-budget">
          <Input
            id="min-budget"
            type="number"
            value={form.eoiRule.minBudget}
            onChange={(e) => setForm({ ...form, eoiRule: { ...form.eoiRule, minBudget: e.target.value } })}
          />
        </FormField>
        <div className="flex gap-2">
          <Input
            value={form.eoiRule.docInput}
            onChange={(e) => setForm({ ...form, eoiRule: { ...form.eoiRule, docInput: e.target.value } })}
            placeholder="Required document (e.g. PAN)"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!form.eoiRule.docInput.trim()) return;
              setForm({
                ...form,
                eoiRule: {
                  ...form.eoiRule,
                  requiredDocuments: [...form.eoiRule.requiredDocuments, form.eoiRule.docInput.trim()],
                  docInput: "",
                },
              });
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.eoiRule.requiredDocuments.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs">
              {d}
              <button type="button" onClick={() => setForm({
                ...form,
                eoiRule: { ...form.eoiRule, requiredDocuments: form.eoiRule.requiredDocuments.filter((x) => x !== d) },
              })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">FAQs</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm({ ...form, faqs: [...form.faqs, { question: "", answer: "" }] })}
          >
            <Plus className="h-4 w-4" /> Add FAQ
          </Button>
        </div>
        {form.faqs.map((faq, index) => (
          <div key={index} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">FAQ {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm({ ...form, faqs: form.faqs.filter((_, i) => i !== index) })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <FormField label="Question" htmlFor={`faq-q-${index}`}>
              <Input
                id={`faq-q-${index}`}
                value={faq.question}
                onChange={(e) => {
                  const faqs = [...form.faqs];
                  faqs[index] = { ...faqs[index], question: e.target.value };
                  setForm({ ...form, faqs });
                }}
              />
            </FormField>
            <FormField label="Answer" htmlFor={`faq-a-${index}`}>
              <Textarea
                id={`faq-a-${index}`}
                value={faq.answer}
                onChange={(e) => {
                  const faqs = [...form.faqs];
                  faqs[index] = { ...faqs[index], answer: e.target.value };
                  setForm({ ...form, faqs });
                }}
                rows={2}
              />
            </FormField>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage real estate projects and EOI settings"
        actions={
          <Button onClick={() => { setForm(emptyForm); setAddOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Project
          </Button>
        }
      />

      <DataTable
        columns={[
          { key: "name", header: "Project" },
          { key: "location", header: "Location" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as string} /> },
          { key: "eoiStatus", header: "EOI", render: (row) => <StatusBadge status={row.eoiStatus === "OPEN" ? "OPEN" : "CLOSED_PROJECT"} /> },
          { key: "eoiCount", header: "EOIs" },
          { key: "activeCPs", header: "Active CPs" },
          { key: "closures", header: "Closures" },
        ]}
        data={projects}
        loading={isLoading}
        emptyTitle="No projects yet"
        emptyDescription="Create your first project to start accepting EOIs."
        actions={(row) => (
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => openAssets(row as Project)} title="Manage Assets">
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row as Project)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openDelete(row as Project)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        )}
      />

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Project"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => handleSave(false)}>Create Project</Button>
          </>
        }
      >
        {formFields}
      </Modal>

      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Project"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => handleSave(true)}>Save Changes</Button>
          </>
        }
      >
        {formFields}
      </Modal>

      <Modal open={assetsOpen} onOpenChange={setAssetsOpen} title={`Manage Assets — ${selected?.name}`} size="lg">
        <div className="space-y-6">
          {ASSET_TYPES.map(({ type, label }) => (
            <div key={type}>
              <p className="text-sm font-medium mb-2">{label}</p>
              <FileUpload
                accept={type === "BANNER" || type === "GALLERY" ? "image/*" : ".pdf,.doc,.docx"}
                file={uploads[type] || null}
                onUpload={(file) => handleAssetUpload(type, file)}
              />
            </div>
          ))}
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploaded Assets</p>
            {assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets uploaded yet.</p>
            ) : (
              assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{asset.fileName}</p>
                    <p className="text-xs text-muted-foreground">{asset.type}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleAssetDelete(asset.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Project"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={saving} onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong className="text-foreground">{selected?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
