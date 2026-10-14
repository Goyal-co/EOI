"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button, Input, PageHeader, StatusBadge, useToast, cn, LoadingSkeleton, EmptyState,
} from "@goyal/ui";
import {
  Search, Send, CheckCircle, Filter, MessageSquare,
} from "lucide-react";
import { publicPortalPath } from "@/lib/portal-paths";
import Link from "next/link";

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED";

interface TicketListItem {
  id: string;
  number: string;
  category: string;
  categoryLabel: string;
  status: string;
  priority: string;
  source: string;
  lastMessageAt: string;
  createdAt: string;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  projectName: string | null;
  partner: {
    id: string;
    userId: string;
    name: string;
    email: string;
    companyName: string | null;
    mobile: string | null;
  };
  lastMessagePreview: string;
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string;
  senderRole: string;
  attachmentName?: string | null;
}

interface TicketDetail extends TicketListItem {
  messages: ThreadMessage[];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";
}

function statusTone(status: string) {
  if (status === "OPEN") return "bg-red-100 text-red-700";
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-700";
}

export default function AdminSupportPage() {
  const { addToast } = useToast();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [q, setQ] = useState("");
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [meta, setMeta] = useState({ openCount: 0, unassigned: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "chat" | "details">("list");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/support/tickets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tickets");
      setTickets(data.tickets || []);
      setMeta(data.meta || { openCount: 0, unassigned: 0, total: 0 });
    } catch (e) {
      addToast({ type: "error", title: "Load failed", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [status, q, addToast]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load ticket");
      setDetail(data);
    } catch (e) {
      addToast({ type: "error", title: "Failed to open ticket", message: (e as Error).message });
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    setLoading(true);
    void loadList();
    const id = setInterval(() => void loadList(), 10000);
    return () => clearInterval(id);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
    const id = setInterval(() => void loadDetail(selectedId), 8000);
    return () => clearInterval(id);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages?.length]);

  const selectTicket = (id: string) => {
    setSelectedId(id);
    setMobilePane("chat");
    setReply("");
  };

  const patchTicket = async (body: Record<string, unknown>) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      await loadDetail(selectedId);
      await loadList();
      addToast({ type: "success", title: "Ticket updated" });
    } catch (e) {
      addToast({ type: "error", title: "Update failed", message: (e as Error).message });
    }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setReply("");
      await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      addToast({ type: "error", title: "Send failed", message: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const filters: StatusFilter[] = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"];

  const listPane = (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-white">
      <div className="space-y-3 border-b border-border p-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                status === f ? "bg-navy text-white" : "bg-slate-100 text-muted-foreground hover:bg-slate-200",
              )}
            >
              {f === "IN_PROGRESS" ? "In Progress" : f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tickets..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4"><LoadingSkeleton rows={6} /></div>
        ) : tickets.length === 0 ? (
          <EmptyState title="No tickets" description="Partner support conversations will appear here." />
        ) : (
          tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTicket(t.id)}
              className={cn(
                "flex w-full gap-3 border-b border-border/70 px-3 py-3 text-left transition hover:bg-blue-50/60",
                selectedId === t.id && "bg-blue-50",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
                {initials(t.partner.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{t.partner.name}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(t.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{t.lastMessagePreview || t.categoryLabel}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusTone(t.status))}>
                    {t.status.replace("_", " ")}
                  </span>
                  {t.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {t.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const chatPane = (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {!selectedId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Select a ticket</p>
          <p className="text-xs text-muted-foreground">Choose a conversation from the list to reply.</p>
        </div>
      ) : detailLoading && !detail ? (
        <div className="p-6"><LoadingSkeleton rows={8} /></div>
      ) : detail ? (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
            <div className="min-w-0">
              <button
                type="button"
                className="mb-1 text-xs font-medium text-navy lg:hidden"
                onClick={() => setMobilePane("list")}
              >
                ← Back to list
              </button>
              <p className="truncate text-sm font-semibold text-foreground">{detail.partner.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                Channel Partner{detail.partner.companyName ? ` · ${detail.partner.companyName}` : ""}
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
                </span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="lg:hidden"
                onClick={() => setMobilePane("details")}
              >
                <Filter className="h-4 w-4" />
              </Button>
              {detail.status !== "RESOLVED" && (
                <Button
                  size="sm"
                  variant="gold"
                  onClick={() => patchTicket({ status: "RESOLVED" })}
                >
                  <CheckCircle className="mr-1 h-4 w-4" />
                  Mark Resolved
                </Button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {detail.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                    m.mine ? "rounded-br-md bg-blue-100 text-foreground" : "rounded-bl-md bg-white text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {m.attachmentName && (
                    <p className="mt-1 text-xs text-muted-foreground">Attachment: {m.attachmentName}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-white p-3">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
              placeholder="Type a message..."
              className="min-w-0 flex-1 rounded-full border border-border bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-navy/40"
              disabled={detail.status === "RESOLVED"}
            />
            <button
              type="button"
              disabled={sending || !reply.trim() || detail.status === "RESOLVED"}
              onClick={sendReply}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-white disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );

  const detailsPane = detail ? (
    <div className="h-full min-h-0 overflow-y-auto border-l border-border bg-white p-4 space-y-4">
      <button
        type="button"
        className="text-xs font-medium text-navy lg:hidden"
        onClick={() => setMobilePane("chat")}
      >
        ← Back to chat
      </button>
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Ticket Details</h3>
        <DetailRow label="Ticket ID" value={detail.number} />
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            className="rounded-md border border-border bg-white px-2 py-1 text-sm"
            value={detail.status}
            onChange={(e) => patchTicket({ status: e.target.value })}
          >
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <DetailRow label="Created On" value={new Date(detail.createdAt).toLocaleString()} />
        <DetailRow label="Category" value={detail.categoryLabel} />
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Priority</span>
          <select
            className="rounded-md border border-border bg-white px-2 py-1 text-sm"
            value={detail.priority}
            onChange={(e) => patchTicket({ priority: e.target.value })}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <DetailRow label="Assigned To" value={detail.assignedAdminName || "Unassigned"} />
        <DetailRow label="Source" value={detail.source.replace(/_/g, " ")} />
        <DetailRow label="Project" value={detail.projectName || "—"} />
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Partner Information</h3>
        <DetailRow label="Name" value={detail.partner.name} />
        <DetailRow label="Agency" value={detail.partner.companyName || "—"} />
        <DetailRow label="Phone" value={detail.partner.mobile || "—"} />
        <DetailRow label="Email" value={detail.partner.email} />
        <Link
          href={`/admin/channel-partners`}
          className="inline-block text-xs font-semibold text-navy hover:underline"
        >
          View Partner Profile
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="gold"
          size="sm"
          onClick={() => patchTicket({ assignedAdminId: "self", status: "IN_PROGRESS" })}
          disabled={detail.status === "RESOLVED"}
        >
          Assign to me
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => patchTicket({ assignedAdminId: null })}
          disabled={!detail.assignedAdminId}
        >
          Unassign
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => patchTicket({ status: "IN_PROGRESS" })}
          disabled={detail.status === "IN_PROGRESS"}
        >
          Mark In Progress
        </Button>
      </div>
    </div>
  ) : (
    <div className="hidden h-full items-center justify-center border-l border-border bg-white p-6 text-center text-sm text-muted-foreground lg:flex">
      Ticket details appear here
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[420px] flex-col gap-4">
      <PageHeader
        title="Support Tickets"
        description="Live partner support conversations"
        breadcrumb={[
          { label: "Dashboard", href: publicPortalPath("/admin") },
          { label: "Support Tickets" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status="OPEN" />
            <span>{meta.openCount} open</span>
            {meta.unassigned > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                {meta.unassigned} unassigned
              </span>
            )}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Mobile: one pane at a time */}
        <div className="grid h-full lg:hidden">
          {mobilePane === "list" && listPane}
          {mobilePane === "chat" && chatPane}
          {mobilePane === "details" && detailsPane}
        </div>
        {/* Desktop: 3 columns */}
        <div className="hidden h-full grid-cols-[280px_minmax(0,1fr)_280px] lg:grid">
          {listPane}
          {chatPane}
          {detailsPane}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground break-all">{value}</span>
    </div>
  );
}
