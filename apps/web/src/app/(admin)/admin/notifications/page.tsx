"use client";

import { useState } from "react";
import {
  Card, Badge, Button, useToast, EmptyState, LoadingSkeleton, PageHeader,
} from "@goyal/ui";
import { Bell, CheckCheck, Mail, MailOpen } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/lib/hooks";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

interface NotificationsData {
  notifications: Notification[];
  unreadCount: number;
}

export default function AdminNotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const { addToast } = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const notifData = data as NotificationsData | undefined;
  const notifications = notifData?.notifications || [];
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const handleMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync({ ids: [id] });
    } catch {
      addToast({ type: "error", title: "Failed to mark as read" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markRead.mutateAsync({ markAll: true });
      addToast({ type: "success", title: "All notifications marked as read" });
    } catch {
      addToast({ type: "error", title: "Failed to mark all as read" });
    }
  };

  if (isLoading) {
    return <div className="space-y-6"><LoadingSkeleton rows={5} /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          notifData?.unreadCount
            ? `${notifData.unreadCount} unread notification${notifData.unreadCount !== 1 ? "s" : ""}`
            : "You're all caught up"
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("unread")}
            >
              Unread
              {(notifData?.unreadCount ?? 0) > 0 && (
                <Badge variant="warning" className="ml-1">{notifData!.unreadCount}</Badge>
              )}
            </Button>
            {(notifData?.unreadCount ?? 0) > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} loading={markRead.isPending}>
                <CheckCheck className="h-4 w-4" /> Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={filter === "unread" ? "No unread notifications" : "No notifications"}
          description={filter === "unread" ? "You've read all your notifications." : "Notifications will appear here as activity occurs."}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => (
            <Card
              key={notif.id}
              className={`p-4 transition-colors ${!notif.read ? "border-l-4 border-l-[#2563EB] bg-blue-50/30" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-lg p-2 ${!notif.read ? "bg-[#E8F0FE]" : "bg-blue-50"}`}>
                  {notif.read ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-[#2563EB]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground text-sm">{notif.title}</h3>
                    {!notif.read && <Badge variant="default">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{notif.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(notif.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                {!notif.read && (
                  <Button variant="ghost" size="sm" onClick={() => handleMarkRead(notif.id)}>
                    <Bell className="h-4 w-4" /> Mark Read
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
