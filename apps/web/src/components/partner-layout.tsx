"use client";

import { AppShell, LogoutConfirmModal } from "@goyal/ui";
import {
  LayoutDashboard, Building2, UserCheck, FileText,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/hooks";
import { useGlobalSearch } from "@/components/use-global-search";
import { useState } from "react";
import { useRequireRole } from "@/lib/use-require-role";

const sidebarItems = [
  { label: "Dashboard", href: "/partner", icon: LayoutDashboard },
  { label: "Projects", href: "/partner/projects", icon: Building2 },
  { label: "My Leads", href: "/partner/leads", icon: UserCheck },
  { label: "My EOIs", href: "/partner/eois", icon: FileText },
];

export function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: notifData } = useNotifications();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const search = useGlobalSearch();
  useRequireRole("CHANNEL_PARTNER");

  return (
    <>
      <AppShell
        sidebar={{
          items: sidebarItems,
          title: "",
          subtitle: "Partner Portal",
          profile: {
            name: session?.user?.name || "Partner",
            role: "Channel Partner",
          },
          onSettingsClick: () => router.push("/partner/settings"),
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
          profileName: session?.user?.name || "Partner",
          profileRole: "Channel Partner",
          onProfileClick: () => router.push("/partner/profile"),
          onHelpClick: () => {
            window.location.href = "mailto:support@goyalprojects.com";
          },
        }}
      >
        <div className="min-w-0">{children}</div>
      </AppShell>

      <LogoutConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={() => signOut({ callbackUrl: "/partner/login" })}
      />
    </>
  );
}
