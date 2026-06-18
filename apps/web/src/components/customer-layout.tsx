"use client";

import { useState } from "react";
import { AppShell, LogoutConfirmModal, brand } from "@goyal/ui";
import {
  LayoutDashboard, Building2, FileText, FolderOpen,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/hooks";
import { useGlobalSearch } from "@/components/use-global-search";
import { CustomerProjectSwitcher } from "@/components/customer/customer-project-switcher";

const sidebarItems = [
  { label: "Dashboard", href: "/customer", icon: LayoutDashboard },
  { label: "Project Details", href: "/customer/project", icon: Building2 },
  { label: "My EOI", href: "/customer/my-eoi", icon: FileText },
  { label: "Documents", href: "/customer/documents", icon: FolderOpen },
];

export function CustomerLayout({ children }: { children: React.ReactNode }) {
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
          subtitle: "Customer Portal",
          profile: {
            name: session?.user?.name || "Customer",
            role: "Customer",
          },
          onSettingsClick: () => router.push("/customer/profile"),
          onLogout: () => setLogoutOpen(true),
        }}
        navbar={{
          searchPlaceholder: "Search project, EOI...",
          searchQuery: search.query,
          onSearchChange: search.setQuery,
          searchResults: search.results,
          onSearchSelect: search.onSelect,
          notificationCount: notifData?.unreadCount || 0,
          onNotificationsClick: () => router.push("/customer/notifications"),
          profileName: session?.user?.name || "Customer",
          profileRole: "Customer",
          onProfileClick: () => router.push("/customer/profile"),
          showDate: false,
          onHelpClick: () => {
            window.location.href = "mailto:support@goyalprojects.com";
          },
          children: <CustomerProjectSwitcher />,
        }}
      >
        {children}
      </AppShell>

      <LogoutConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={() => signOut({ callbackUrl: "/customer/login" })}
      />
    </>
  );
}
