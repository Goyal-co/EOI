"use client";

import { AppShell, LogoutConfirmModal, brand } from "@goyal/ui";
import {
  LayoutDashboard, Building2, Users, UserCheck, FileText,
  CheckCircle, BarChart3, Bell, Settings, ScrollText,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/hooks";
import { useGlobalSearch } from "@/components/use-global-search";
import { useState } from "react";

const sidebarItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Projects", href: "/admin/projects", icon: Building2 },
  { label: "Channel Partners", href: "/admin/channel-partners", icon: Users },
  { label: "Leads", href: "/admin/leads", icon: UserCheck },
  { label: "Customer EOIs", href: "/admin/eois", icon: FileText },
  { label: "Approvals", href: "/admin/approvals", icon: CheckCircle },
  { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: notifData } = useNotifications();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const search = useGlobalSearch();

  return (
    <>
      <AppShell
        sidebar={{
          items: sidebarItems,
          title: brand.appName,
          subtitle: "Admin Portal",
          profile: {
            name: session?.user?.name || "Admin",
            role: "Administrator",
          },
          onLogout: () => setLogoutOpen(true),
        }}
        navbar={{
          searchPlaceholder: "Search projects, leads, EOIs...",
          searchQuery: search.query,
          onSearchChange: search.setQuery,
          searchResults: search.results,
          onSearchSelect: search.onSelect,
          notificationCount: notifData?.unreadCount || 0,
          onNotificationsClick: () => router.push("/admin/notifications"),
          onQuickAction: () => router.push("/admin/projects"),
          quickActionLabel: "Add Project",
        }}
      >
        {children}
      </AppShell>

      <LogoutConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={() => signOut({ callbackUrl: "/login" })}
      />
    </>
  );
}
