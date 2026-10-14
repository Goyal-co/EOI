"use client";

import { AppShell, LogoutConfirmModal } from "@goyal/ui";
import {
  LayoutDashboard, Building2, Users, UserCheck, FileText,
  CheckCircle, BarChart3, ScrollText, Megaphone, BookOpen, Images, Headphones,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/hooks";
import { useGlobalSearch } from "@/components/use-global-search";
import { useMemo, useState } from "react";
import { useRequireRole } from "@/lib/use-require-role";
import { useQuery } from "@tanstack/react-query";

const baseSidebarItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Projects", href: "/admin/projects", icon: Building2 },
  { label: "Portal Guide", href: "/admin/portal-guide", icon: BookOpen },
  { label: "Promotions", href: "/admin/promotions", icon: Images },
  { label: "Channel Partners", href: "/admin/channel-partners", icon: Users },
  { label: "Leads", href: "/admin/leads", icon: UserCheck },
  { label: "Customer EOIs", href: "/admin/eois", icon: FileText },
  { label: "Approvals", href: "/admin/approvals", icon: CheckCircle },
  { label: "Support Tickets", href: "/admin/support", icon: Headphones },
  { label: "Communications", href: "/admin/communications", icon: Megaphone },
  { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

function useSupportUnread() {
  return useQuery({
    queryKey: ["admin", "support", "unread"],
    queryFn: async () => {
      const res = await fetch("/api/admin/support/unread-count");
      if (!res.ok) return { liveTickets: 0, unassigned: 0, unreadMessages: 0 };
      return res.json() as Promise<{ liveTickets: number; unassigned: number; unreadMessages: number }>;
    },
    refetchInterval: 15000,
  });
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: notifData } = useNotifications();
  const { data: supportMeta } = useSupportUnread();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const search = useGlobalSearch();
  const { allowed } = useRequireRole("ADMIN");

  const sidebarItems = useMemo(
    () =>
      baseSidebarItems.map((item) =>
        item.href === "/admin/support"
          ? { ...item, badge: supportMeta?.liveTickets || undefined }
          : item,
      ),
    [supportMeta?.liveTickets],
  );

  if (!allowed) return <div className="min-h-screen bg-background" />;

  return (
    <>
      <AppShell
        sidebar={{
          items: sidebarItems,
          title: "",
          subtitle: "Admin Portal",
          profile: {
            name: session?.user?.name || "Admin",
            role: "Administrator",
          },
          onSettingsClick: () => router.push("/admin/settings"),
          onLogout: () => setLogoutOpen(true),
        }}
        navbar={{
          searchPlaceholder: "Search projects, partners, EOIs...",
          searchQuery: search.query,
          onSearchChange: search.setQuery,
          searchResults: search.results,
          onSearchSelect: search.onSelect,
          notificationCount: notifData?.unreadCount || 0,
          onNotificationsClick: () => router.push("/admin/notifications"),
          profileName: session?.user?.name || "Admin",
          profileRole: "Administrator",
          onProfileClick: () => router.push("/admin/settings"),
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
