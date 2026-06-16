"use client";

import {
  Card, CardContent, Button, LoadingSkeleton, EmptyState, formatDate,
  PageHeader, cn,
} from "@goyal/ui";
import { useNotifications, useMarkNotificationsRead } from "@/lib/hooks";
import { Bell, CheckCheck } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export default function CustomerNotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const notifications = (data?.notifications as Notification[]) || [];

  const handleMarkAllRead = () => {
    markRead.mutate({ markAll: true });
  };

  const handleMarkRead = (id: string) => {
    markRead.mutate({ ids: [id] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={data?.unreadCount ? `${data.unreadCount} unread` : "All caught up"}
        actions={
          data?.unreadCount ? (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} loading={markRead.isPending}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="No Notifications"
          description="You'll be notified about EOI status updates and important announcements."
          icon={<Bell className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={cn(
                "cursor-pointer transition-colors",
                !notif.read && "border-gold/30 bg-gold-light/30"
              )}
              onClick={() => !notif.read && handleMarkRead(notif.id)}
            >
              <CardContent className="p-4 flex items-start gap-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                  notif.read ? "bg-blue-50" : "bg-gold-light"
                )}>
                  <Bell className={cn("h-5 w-5", notif.read ? "text-muted-foreground" : "text-gold")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-medium", !notif.read && "text-foreground")}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-gold shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(notif.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
