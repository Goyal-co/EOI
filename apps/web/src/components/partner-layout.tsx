"use client";

import { AppShell, LogoutConfirmModal } from "@goyal/ui";
import {
  LayoutDashboard, Building2, UserCheck, FileText, Users,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/hooks";
import { useGlobalSearch } from "@/components/use-global-search";
import { useMemo, useState } from "react";
import { useRequirePartnerAccess } from "@/lib/use-require-partner";

const allSidebarItems = [
  { label: "Dashboard", href: "/partner", icon: LayoutDashboard, ownerOnly: false },
  { label: "Projects", href: "/partner/projects", icon: Building2, ownerOnly: false },
  { label: "My Leads", href: "/partner/leads", icon: UserCheck, ownerOnly: false },
  { label: "My EOIs", href: "/partner/eois", icon: FileText, ownerOnly: false },
  { label: "My Team", href: "/partner/team", icon: Users, ownerOnly: true },
];

export function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: notifData } = useNotifications();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const search = useGlobalSearch();
  const { allowed, isOwner } = useRequirePartnerAccess();

  const sidebarItems = useMemo(
    () => allSidebarItems
      .filter((item) => isOwner || !item.ownerOnly)
      .map(({ ownerOnly: _ownerOnly, ...item }) => item),
    [isOwner],
  );

  const profileRole = isOwner ? "Channel Partner" : "Team Member";
  const profileName = session?.user?.name || (isOwner ? "Partner" : "Team Member");

  if (!allowed) return <div className="min-h-screen bg-background" />;

  return (
    <>
      <AppShell
        sidebar={{
          items: sidebarItems,
          title: "",
          subtitle: "Partner Portal",
          profile: {
            name: profileName,
            role: profileRole,
          },
          onSettingsClick: isOwner
            ? () => router.push("/partner/settings")
            : () => router.push("/partner/profile"),
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
          profileName,
          profileRole,
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
