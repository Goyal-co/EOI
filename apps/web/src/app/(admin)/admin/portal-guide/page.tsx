"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Textarea,
  StatusBadge,
  FileUpload,
  useToast,
  LoadingSkeleton,
} from "@goyal/ui";
import { BookOpen, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { uploadViaPresign } from "@/lib/uploads/client-upload";

interface GuideVideo {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationLabel: string | null;
  durationSec: number | null;
  featured: boolean;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  durationLabel: "",
  featured: false,
  sortOrder: "0",
  active: true,
};

export default function AdminPortalGuidePage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GuideVideo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GuideVideo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/portal-guide");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      addToast({
        type: "error",
        title: "Load failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: GuideVideo) => {
    setEditing(row);
    setForm({
      title: row.title,
      description: row.description || "",
      videoUrl: row.videoUrl,
      thumbnailUrl: row.thumbnailUrl || "",
      durationLabel: row.durationLabel || "",
      featured: row.featured,
      sortOrder: String(row.sortOrder ?? 0),
      active: row.active,
    });
    setModalOpen(true);
  };

  const uploadVideo = async (file: File) => {
    setUploadingVideo(true);
    try {
      const uploaded = await uploadViaPresign(file, "WALKTHROUGH");
      setForm((f) => ({ ...f, videoUrl: uploaded.fileUrl }));
      addToast({ type: "success", title: "Video uploaded" });
    } catch (e) {
      addToast({
        type: "error",
        title: "Video upload failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setUploadingVideo(false);
    }
  };

  const uploadThumb = async (file: File) => {
    setUploadingThumb(true);
    try {
      const uploaded = await uploadViaPresign(file, "GALLERY");
      setForm((f) => ({ ...f, thumbnailUrl: uploaded.fileUrl }));
      addToast({ type: "success", title: "Thumbnail uploaded" });
    } catch (e) {
      addToast({
        type: "error",
        title: "Thumbnail upload failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setUploadingThumb(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      addToast({ type: "error", title: "Title is required" });
      return;
    }
    if (!form.videoUrl) {
      addToast({ type: "error", title: "Upload a video first" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        videoUrl: form.videoUrl,
        thumbnailUrl: form.thumbnailUrl || null,
        durationLabel: form.durationLabel.trim() || null,
        featured: form.featured,
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      };
      const url = editing
        ? `/api/admin/portal-guide/${editing.id}`
        : "/api/admin/portal-guide";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      addToast({
        type: "success",
        title: editing ? "Video updated" : "Video added",
      });
      setModalOpen(false);
      await load();
    } catch (e) {
      addToast({
        type: "error",
        title: "Save failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: GuideVideo) => {
    if (!confirm(`Delete “${row.title}”?`)) return;
    const res = await fetch(`/api/admin/portal-guide/${row.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      addToast({
        type: "error",
        title: "Delete failed",
        message: data.error || "Try again",
      });
      return;
    }
    addToast({ type: "success", title: "Video deleted" });
    await load();
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal Guide"
        description="Upload walkthrough videos shown to channel partners in Portal Guide"
        actions={
          <Button variant="gold" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add video
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <DataTable
          columns={[
            {
              key: "title",
              header: "Title",
              render: (r: GuideVideo) => (
                <div className="flex items-start gap-3">
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-blue-50">
                    {r.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-blue-500">
                        <BookOpen className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-navy">{r.title}</p>
                    <p className="line-clamp-1 text-xs text-muted">
                      {r.description || "No description"}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: "duration",
              header: "Duration",
              render: (r: GuideVideo) => r.durationLabel || "—",
            },
            {
              key: "featured",
              header: "Featured",
              render: (r: GuideVideo) =>
                r.featured ? (
                  <span className="inline-flex items-center gap-1 text-sm text-gold">
                    <Star className="h-3.5 w-3.5 fill-current" /> Featured
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "status",
              header: "Status",
              render: (r: GuideVideo) => (
                <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} />
              ),
            },
            {
              key: "order",
              header: "Order",
              render: (r: GuideVideo) => r.sortOrder,
            },
            {
              key: "actions",
              header: "",
              render: (r: GuideVideo) => (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void remove(r)}>
                    <Trash2 className="h-3.5 w-3.5 text-error" />
                  </Button>
                </div>
              ),
            },
          ]}
          data={rows}
          emptyTitle="No guide videos yet"
          emptyDescription="Add a featured walkthrough and quick guides for partners."
        />
      </Card>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit guide video" : "Add guide video"}
        description="Videos appear in the Partner Portal Guide. Mark one as Featured for the hero section."
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="How to Register a Lead"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">
              Description
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short summary shown under the title"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">
                Duration (MM:SS)
              </label>
              <Input
                value={form.durationLabel}
                onChange={(e) =>
                  setForm({ ...form, durationLabel: e.target.value })
                }
                placeholder="01:35"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">
                Sort order
              </label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({ ...form, featured: e.target.checked })
                }
              />
              Featured (hero walkthrough)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active (visible to partners)
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">
              Video file *
            </label>
            <FileUpload
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              maxSize={100 * 1024 * 1024}
              disabled={uploadingVideo}
              file={
                form.videoUrl
                  ? {
                      name: "guide-video",
                      size: 0,
                      url: form.videoUrl,
                      status: uploadingVideo ? "uploading" : "success",
                    }
                  : null
              }
              onUpload={(file) => void uploadVideo(file)}
              onRemove={() => setForm((f) => ({ ...f, videoUrl: "" }))}
              onSizeError={(file, max) =>
                addToast({
                  type: "error",
                  title: "File too large",
                  message: `${file.name} exceeds ${Math.round(max / (1024 * 1024))}MB`,
                })
              }
            />
            {form.videoUrl ? (
              <video
                src={form.videoUrl}
                controls
                className="mt-2 max-h-40 w-full rounded-lg border border-border bg-black"
              />
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">
              Thumbnail image
            </label>
            <FileUpload
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              maxSize={5 * 1024 * 1024}
              disabled={uploadingThumb}
              file={
                form.thumbnailUrl
                  ? {
                      name: "thumbnail",
                      size: 0,
                      url: form.thumbnailUrl,
                      status: uploadingThumb ? "uploading" : "success",
                    }
                  : null
              }
              onUpload={(file) => void uploadThumb(file)}
              onRemove={() => setForm((f) => ({ ...f, thumbnailUrl: "" }))}
              onSizeError={(file, max) =>
                addToast({
                  type: "error",
                  title: "File too large",
                  message: `${file.name} exceeds ${Math.round(max / (1024 * 1024))}MB`,
                })
              }
            />
            {form.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.thumbnailUrl}
                alt="Thumbnail"
                className="mt-2 h-24 rounded-lg border border-border object-cover"
              />
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add video"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
