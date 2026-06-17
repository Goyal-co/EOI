"use client";

import { AppShell, LogoutConfirmModal, brand } from "@goyal/ui";
import {
  LayoutDashboard, Building2, UserCheck, FileText, Bell, User, Settings,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/hooks";
import { useGlobalSearch } from "@/components/use-global-search";
import { useState } from "react";

const sidebarItems = [
  { label: "Dashboard", href: "/partner", icon: LayoutDashboard },
  { label: "Projects", href: "/partner/projects", icon: Building2 },
  { label: "My Leads", href: "/partner/leads", icon: UserCheck },
  { label: "My EOIs", href: "/partner/eois", icon: FileText },
  { label: "Notifications", href: "/partner/notifications", icon: Bell },
  { label: "Profile", href: "/partner/profile", icon: User },
  { label: "Settings", href: "/partner/settings", icon: Settings },
];

export function PartnerLayout({ children }: { children: React.ReactNode }) {
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
          subtitle: "Partner Portal",
          profile: {
            name: session?.user?.name || "Partner",
            role: "Channel Partner",
          },
          onLogout: () => setLogoutOpen(true),
        }}
        navbar={{
          searchPlaceholder: "Search projects, leads...",
          searchQuery: search.query,
          onSearchChange: search.setQuery,
          searchResults: search.results,
          onSearchSelect: search.onSelect,
          notificationCount: notifData?.unreadCount || 0,
          onNotificationsClick: () => router.push("/partner/notifications"),
          onHelpClick: () => {
            window.location.href = "mailto:support@goyalprojects.com";
          },
        }}
      >
        {children}
      </AppShell>

      <LogoutConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={() => signOut({ callbackUrl: "/partner/login" })}
      />
    </>
  );
}
