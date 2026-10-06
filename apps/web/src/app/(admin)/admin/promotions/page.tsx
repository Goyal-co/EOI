"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  PageHeader,
  StatusBadge,
  FileUpload,
  useToast,
  LoadingSkeleton,
} from "@goyal/ui";
import { Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import {
  PARTNER_PROMO_HEIGHT,
  PARTNER_PROMO_IMAGE_MAX_BYTES,
  PARTNER_PROMO_VIDEO_MAX_BYTES,
  PARTNER_PROMO_WIDTH,
} from "@goyal/types";
import { uploadViaPresign } from "@/lib/uploads/client-upload";

type MediaKind = "IMAGE" | "GIF" | "VIDEO";

interface Promotion {
  id: string;
  title: string;
  mediaUrl: string;
  mediaKind: MediaKind;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  title: "",
  mediaUrl: "",
  mediaKind: "IMAGE" as MediaKind,
  linkUrl: "",
  sortOrder: "0",
  active: true,
  startsAt: "",
  endsAt: "",
  width: undefined as number | undefined,
  height: undefined as number | undefined,
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function detectMediaKind(file: File): MediaKind {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime === "image/gif" || name.endsWith(".gif")) return "GIF";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov)$/.test(name)) return "VIDEO";
  return "IMAGE";
}

export default function AdminPromotionsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Promotion[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promotions");
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

  const openEdit = (row: Promotion) => {
    setEditing(row);
    setForm({
      title: row.title,
      mediaUrl: row.mediaUrl,
      mediaKind: row.mediaKind,
      linkUrl: row.linkUrl || "",
      sortOrder: String(row.sortOrder ?? 0),
      active: row.active,
      startsAt: toLocalInputValue(row.startsAt),
      endsAt: toLocalInputValue(row.endsAt),
      width: PARTNER_PROMO_WIDTH,
      height: PARTNER_PROMO_HEIGHT,
    });
    setModalOpen(true);
  };

  const readImageDims = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image dimensions"));
      };
      img.src = url;
    });

  const uploadMedia = async (file: File) => {
    const kind = detectMediaKind(file);
    const maxBytes =
      kind === "VIDEO" ? PARTNER_PROMO_VIDEO_MAX_BYTES : PARTNER_PROMO_IMAGE_MAX_BYTES;

    if (file.size > maxBytes) {
      addToast({
        type: "error",
        title: "File too large",
        message: `${kind === "VIDEO" ? "Videos" : "Images/GIFs"} must be ≤ ${Math.round(maxBytes / (1024 * 1024))} MB`,
      });
      return;
    }

    let dims: { width: number; height: number } | undefined;
    if (kind === "IMAGE" || kind === "GIF") {
      try {
        dims = await readImageDims(file);
        if (dims.width !== PARTNER_PROMO_WIDTH || dims.height !== PARTNER_PROMO_HEIGHT) {
          addToast({
            type: "error",
            title: "Invalid creative size",
            message: `Must be exactly ${PARTNER_PROMO_WIDTH}×${PARTNER_PROMO_HEIGHT}px (got ${dims.width}×${dims.height})`,
          });
          return;
        }
      } catch (e) {
        addToast({
          type: "error",
          title: "Size check failed",
          message: e instanceof Error ? e.message : "Try again",
        });
        return;
      }
    }

    setUploading(true);
    try {
      const uploaded = await uploadViaPresign(
        file,
        kind === "VIDEO" ? "WALKTHROUGH" : "GALLERY",
      );
      setForm((f) => ({
        ...f,
        mediaUrl: uploaded.fileUrl,
        mediaKind: kind,
        width: dims?.width ?? f.width,
        height: dims?.height ?? f.height,
      }));
      addToast({ type: "success", title: "Creative uploaded" });
    } catch (e) {
      addToast({
        type: "error",
        title: "Upload failed",
        message: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      addToast({ type: "error", title: "Title is required" });
      return;
    }
    if (!form.mediaUrl) {
      addToast({ type: "error", title: "Upload a creative first" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        mediaUrl: form.mediaUrl,
        mediaKind: form.mediaKind,
        linkUrl: form.linkUrl.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
        startsAt: fromLocalInputValue(form.startsAt),
        endsAt: fromLocalInputValue(form.endsAt),
        ...(form.mediaKind === "IMAGE" || form.mediaKind === "GIF"
          ? {
              width: form.width ?? PARTNER_PROMO_WIDTH,
              height: form.height ?? PARTNER_PROMO_HEIGHT,
            }
          : {}),
      };
      const url = editing
        ? `/api/admin/promotions/${editing.id}`
        : "/api/admin/promotions";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      addToast({
        type: "success",
        title: editing ? "Promotion updated" : "Promotion added",
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

  const remove = async (row: Promotion) => {
    if (!confirm(`Delete “${row.title}”?`)) return;
    const res = await fetch(`/api/admin/promotions/${row.id}`, {
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
    addToast({ type: "success", title: "Promotion deleted" });
    await load();
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description="Partner dashboard promotional carousel (1920×480)"
        actions={
          <Button variant="gold" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add promotion
          </Button>
        }
      />

      <Card className="border-amber-200 bg-amber-50/70 p-4">
        <p className="text-sm font-semibold text-amber-950">Designer specs</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
          <li>
            Exact size: <strong>{PARTNER_PROMO_WIDTH} × {PARTNER_PROMO_HEIGHT} px</strong> (4:1)
          </li>
          <li>Formats: JPG / PNG / WebP / GIF, or short MP4 / WebM video</li>
          <li>
            Max size: images/GIFs {Math.round(PARTNER_PROMO_IMAGE_MAX_BYTES / (1024 * 1024))} MB ·
            videos {Math.round(PARTNER_PROMO_VIDEO_MAX_BYTES / (1024 * 1024))} MB
          </li>
        </ul>
      </Card>

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={[
            {
              key: "title",
              header: "Creative",
              render: (r: Promotion) => (
                <div className="flex items-start gap-3">
                  <div className="h-12 w-24 shrink-0 overflow-hidden rounded-md bg-blue-50">
                    {r.mediaKind === "VIDEO" ? (
                      <video
                        src={r.mediaUrl}
                        muted
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.mediaUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-navy">{r.title}</p>
                    <p className="text-xs text-muted">{r.mediaKind}</p>
                  </div>
                </div>
              ),
            },
            {
              key: "schedule",
              header: "Schedule",
              render: (r: Promotion) => {
                if (!r.startsAt && !r.endsAt) return "Always";
                const start = r.startsAt ? new Date(r.startsAt).toLocaleDateString() : "—";
                const end = r.endsAt ? new Date(r.endsAt).toLocaleDateString() : "—";
                return `${start} → ${end}`;
              },
            },
            {
              key: "status",
              header: "Status",
              render: (r: Promotion) => (
                <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} />
              ),
            },
            {
              key: "order",
              header: "Order",
              render: (r: Promotion) => r.sortOrder,
            },
            {
              key: "actions",
              header: "",
              render: (r: Promotion) => (
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
          emptyTitle="No promotions yet"
          emptyDescription="Add carousel creatives for the Partner dashboard."
        />
      </Card>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit promotion" : "Add promotion"}
        description={`Upload a ${PARTNER_PROMO_WIDTH}×${PARTNER_PROMO_HEIGHT} creative for the Partner dashboard carousel.`}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Required: <strong>{PARTNER_PROMO_WIDTH}×{PARTNER_PROMO_HEIGHT}px</strong> · JPG/PNG/WebP/GIF
            (max {Math.round(PARTNER_PROMO_IMAGE_MAX_BYTES / (1024 * 1024))} MB) or MP4/WebM
            (max {Math.round(PARTNER_PROMO_VIDEO_MAX_BYTES / (1024 * 1024))} MB)
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Summer launch offer"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">
              Click-through URL (optional)
            </label>
            <Input
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">
                Starts at (optional)
              </label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">
                Ends at (optional)
              </label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="inline-flex items-end gap-2 pb-2 text-sm text-navy">
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
              Creative file *
            </label>
            <FileUpload
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm"
              maxSize={PARTNER_PROMO_VIDEO_MAX_BYTES}
              disabled={uploading}
              file={
                form.mediaUrl
                  ? {
                      name: form.mediaKind.toLowerCase(),
                      size: 0,
                      url: form.mediaUrl,
                      status: uploading ? "uploading" : "success",
                    }
                  : null
              }
              onUpload={(file) => void uploadMedia(file)}
              onRemove={() =>
                setForm((f) => ({
                  ...f,
                  mediaUrl: "",
                  width: undefined,
                  height: undefined,
                }))
              }
              onSizeError={(file, max) =>
                addToast({
                  type: "error",
                  title: "File too large",
                  message: `${file.name} exceeds ${Math.round(max / (1024 * 1024))}MB`,
                })
              }
            />
            {form.mediaUrl ? (
              form.mediaKind === "VIDEO" ? (
                <video
                  src={form.mediaUrl}
                  controls
                  muted
                  className="mt-2 max-h-40 w-full rounded-lg border border-border bg-black object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.mediaUrl}
                  alt="Promotion preview"
                  className="mt-2 max-h-40 w-full rounded-lg border border-border object-contain"
                />
              )
            ) : (
              <div className="mt-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-muted">
                <ImageIcon className="mr-2 h-5 w-5" />
                {PARTNER_PROMO_WIDTH}×{PARTNER_PROMO_HEIGHT} preview
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add promotion"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
