"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Headphones, ChevronLeft, Minimize2, ImagePlus } from "lucide-react";
import { SUPPORT_CATEGORY_LABELS, type SupportTicketCategory } from "@goyal/types";
import { cn } from "@goyal/ui";
import { uploadViaPresign } from "@/lib/uploads/client-upload";

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const CATEGORIES = Object.entries(SUPPORT_CATEGORY_LABELS) as [SupportTicketCategory, string][];

type View = "home" | "compose" | "thread" | "list";

interface TicketSummary {
  id: string;
  number: string;
  category: SupportTicketCategory;
  categoryLabel: string;
  status: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

interface PendingPhoto {
  url: string;
  name: string;
  size: number;
}

interface PartnerSupportWidgetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PartnerSupportWidget({ open: controlledOpen, onOpenChange }: PartnerSupportWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };

  const [view, setView] = useState<View>("home");
  const [category, setCategory] = useState<SupportTicketCategory | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [thread, setThread] = useState<{
    id: string;
    number: string;
    status: string;
    categoryLabel: string;
    messages: ThreadMessage[];
  } | null>(null);
  const [reply, setReply] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/support/tickets");
      if (!res.ok) return;
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  const loadThread = useCallback(async (ticketId: string) => {
    try {
      const res = await fetch(`/api/partner/support/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      setThread(data);
      setActiveTicketId(ticketId);
      setView("thread");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTickets();
      if (view === "home") setError(null);
    }
  }, [open, loadTickets, view]);

  useEffect(() => {
    if (!open || view !== "thread" || !activeTicketId) return;
    const id = setInterval(() => loadThread(activeTicketId), 8000);
    return () => clearInterval(id);
  }, [open, view, activeTicketId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  const startCategory = (cat: SupportTicketCategory) => {
    setCategory(cat);
    setMessage("");
    setError(null);
    setView("compose");
  };

  const createTicket = async () => {
    if (!category || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create ticket");
      setMessage("");
      await loadTickets();
      await loadThread(data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const onPhotoSelected = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > PHOTO_MAX_BYTES) {
      setError("Photo must be 10 MB or smaller");
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    try {
      const uploaded = await uploadViaPresign(file, "GALLERY");
      setPendingPhoto({
        url: uploaded.fileUrl,
        name: uploaded.fileName,
        size: uploaded.fileSize,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const sendReply = async () => {
    if (!activeTicketId || (!reply.trim() && !pendingPhoto)) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner/support/tickets/${activeTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: reply.trim(),
          attachmentUrl: pendingPhoto?.url,
          attachmentName: pendingPhoto?.name,
          attachmentSize: pendingPhoto?.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setReply("");
      setPendingPhoto(null);
      await loadThread(activeTicketId);
      await loadTickets();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const unreadTotal = tickets.reduce((n, t) => n + (t.unreadCount || 0), 0);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-8 right-[5.25rem] z-[250] rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-md"
        >
          Need help?
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-5 right-5 z-[250] flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-lg transition hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold",
          "pb-[env(safe-area-inset-bottom)]",
        )}
        aria-label={open ? "Close support chat" : "Open support chat"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unreadTotal > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "fixed z-[260] flex flex-col overflow-hidden border border-border bg-white shadow-2xl",
            "bottom-[5.5rem] right-4 left-4 max-h-[min(560px,calc(100dvh-7rem))] rounded-2xl sm:left-auto sm:w-[380px]",
            "pb-[env(safe-area-inset-bottom)]",
          )}
          role="dialog"
          aria-label="Partner Support"
        >
          <div className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
            {(view === "compose" || view === "thread" || view === "list") && (
              <button
                type="button"
                className="rounded-md p-1 hover:bg-white/10"
                onClick={() => {
                  setView("home");
                  setThread(null);
                  setActiveTicketId(null);
                  setCategory(null);
                }}
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <Headphones className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Partner Support</p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online
              </p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
            {view === "home" && (
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">How can we help?</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Choose a topic below. Our team will reply here — you can also reopen past tickets anytime.
                  </p>
                </div>
                <div className="space-y-2">
                  {CATEGORIES.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => startCategory(key)}
                      className="flex w-full items-center rounded-full border border-border bg-white px-4 py-2.5 text-left text-sm font-medium text-foreground shadow-sm transition hover:border-navy/30 hover:bg-blue-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {tickets.length > 0 && (
                  <button
                    type="button"
                    className="w-full text-center text-xs font-semibold text-navy hover:underline"
                    onClick={() => setView("list")}
                  >
                    View my tickets ({tickets.length})
                  </button>
                )}
              </div>
            )}

            {view === "list" && (
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => loadThread(t.id)}
                    className="flex w-full flex-col gap-0.5 rounded-xl border border-border bg-white p-3 text-left hover:bg-blue-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-navy">{t.number}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{t.status.replace("_", " ")}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{t.categoryLabel}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{t.lastMessagePreview}</p>
                  </button>
                ))}
              </div>
            )}

            {view === "compose" && category && (
              <div className="flex flex-1 flex-col p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {SUPPORT_CATEGORY_LABELS[category]}
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue..."
                  rows={5}
                  className="w-full flex-1 resize-none rounded-xl border border-border bg-white p-3 text-sm outline-none focus:border-navy/40"
                />
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                <button
                  type="button"
                  disabled={sending || !message.trim()}
                  onClick={createTicket}
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Sending…" : "Start conversation"}
                </button>
              </div>
            )}

            {view === "thread" && thread && (
              <>
                <div className="border-b border-border bg-white px-4 py-2">
                  <p className="text-xs font-semibold text-navy">{thread.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {thread.categoryLabel} · {thread.status.replace("_", " ")}
                  </p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {thread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex", m.mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          m.mine ? "rounded-br-md bg-navy text-white" : "rounded-bl-md bg-white text-foreground",
                        )}
                      >
                        {m.attachmentUrl && (
                          <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.attachmentUrl}
                              alt={m.attachmentName || "Shared photo"}
                              className="max-h-40 w-full rounded-lg object-cover"
                            />
                          </a>
                        )}
                        {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                        <p className={cn("mt-1 text-[10px]", m.mine ? "text-white/70" : "text-muted-foreground")}>
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                {thread.status !== "RESOLVED" ? (
                  <div className="border-t border-border bg-white p-3">
                    {pendingPhoto && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pendingPhoto.url} alt="" className="h-10 w-10 rounded object-cover" />
                        <span className="min-w-0 flex-1 truncate">{pendingPhoto.name}</span>
                        <button type="button" className="font-medium text-navy" onClick={() => setPendingPhoto(null)}>
                          Remove
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => void onPhotoSelected(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        disabled={uploadingPhoto || sending}
                        onClick={() => photoInputRef.current?.click()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-navy disabled:opacity-50"
                        aria-label="Attach photo"
                      >
                        <ImagePlus className="h-4 w-4" />
                      </button>
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendReply();
                          }
                        }}
                        placeholder={uploadingPhoto ? "Uploading photo…" : "Type your message..."}
                        className="min-w-0 flex-1 rounded-full border border-border bg-slate-50 px-4 py-2 text-sm outline-none focus:border-navy/40"
                      />
                      <button
                        type="button"
                        disabled={sending || uploadingPhoto || (!reply.trim() && !pendingPhoto)}
                        onClick={sendReply}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white disabled:opacity-50"
                        aria-label="Send"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="border-t border-border bg-white p-3 text-center text-xs text-muted-foreground">
                    This ticket is resolved. Start a new conversation from Home if you need more help.
                  </p>
                )}
                {error && <p className="bg-white px-3 pb-2 text-xs text-red-600">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
