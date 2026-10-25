"use client";

import { AppShell, LogoutConfirmModal } from "@goyal/ui";
import {
  LayoutDashboard, Building2, UserCheck, FileText, Users, BookOpen,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useNotifications } from "@/lib/hooks";
import { useGlobalSearch } from "@/components/use-global-search";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useRequirePartnerAccess } from "@/lib/use-require-partner";
import { PartnerSupportWidget } from "@/components/partner-support-widget";

const allSidebarItems = [
  { label: "Dashboard", href: "/partner", icon: LayoutDashboard, ownerOnly: false },
  { label: "Projects", href: "/partner/projects", icon: Building2, ownerOnly: false },
  { label: "My Leads", href: "/partner/leads", icon: UserCheck, ownerOnly: false },
  { label: "My EOIs", href: "/partner/eois", icon: FileText, ownerOnly: false },
  { label: "My Team", href: "/partner/team", icon: Users, ownerOnly: true },
  { label: "Portal Guide", href: "/partner/portal-guide", icon: BookOpen, ownerOnly: false },
];

export function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { data: notifData } = useNotifications();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const search = useGlobalSearch();
  const { allowed, isOwner, isTeamLeader } = useRequirePartnerAccess();

  const sidebarItems = useMemo(
    () => allSidebarItems
      .filter((item) => {
        if (!item.ownerOnly) return true;
        if (item.href === "/partner/team") return isOwner || isTeamLeader;
        return isOwner;
      })
      .map(({ ownerOnly: _ownerOnly, ...item }) => item),
    [isOwner, isTeamLeader],
  );

  const profileRole = isOwner
    ? "Channel Partner"
    : isTeamLeader
      ? "Team Leader"
      : "Sales Executive";
  const profileName = session?.user?.name || (isOwner ? "Partner" : "Team Member");

  const onDashboard = pathname === "/partner";

  const openSupport = useCallback(() => {
    setSupportOpen(true);
    if (pathname !== "/partner") router.push("/partner");
  }, [pathname, router]);

  useEffect(() => {
    if (pathname !== "/partner") setSupportOpen(false);
  }, [pathname]);

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
          onHelpClick: openSupport,
        }}
      >
        <div className="min-w-0">{children}</div>
      </AppShell>

      {onDashboard && (
        <PartnerSupportWidget open={supportOpen} onOpenChange={setSupportOpen} />
      )}

      <LogoutConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={() => signOut({ callbackUrl: "/partner/login" })}
      />
    </>
  );
}
