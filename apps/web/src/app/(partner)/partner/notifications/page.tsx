"use client";

import { Card, Button, formatDate, PageHeader, cn } from "@goyal/ui";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/lib/hooks";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export default function PartnerNotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const notifications = (data?.notifications as Notification[] | undefined) || [];

  const handleMarkAllRead = () => {
    markRead.mutate({ markAll: true });
  };

  const handleMarkRead = (id: string) => {
    markRead.mutate({ ids: [id] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={data?.unreadCount ? `${data.unreadCount} unread` : "You're all caught up"}
        actions={
          notifications.some((n) => !n.read) ? (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} loading={markRead.isPending}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-border animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-section-title">No notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">Updates about your leads and EOIs will appear here</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={cn(
                "p-4 cursor-pointer transition-colors hover:bg-blue-50/50",
                !notif.read && "border-l-4 border-l-blue-600 bg-blue-50/30"
              )}
              onClick={() => !notif.read && handleMarkRead(notif.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={cn("text-sm", !notif.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                      {notif.title}
                    </h3>
                    {!notif.read && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notif.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(notif.createdAt)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
