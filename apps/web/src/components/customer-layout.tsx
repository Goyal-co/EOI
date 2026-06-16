"use client";

import { useState } from "react";
import { AppShell, LogoutConfirmModal } from "@goyal/ui";
import {
  LayoutDashboard, Building2, FileText, FolderOpen, Bell, User,
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
  { label: "Notifications", href: "/customer/notifications", icon: Bell },
  { label: "Profile", href: "/customer/profile", icon: User },
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
          title: "Goyal Projects",
          subtitle: "Customer Portal",
          profile: {
            name: session?.user?.name || "Customer",
            role: "Customer",
          },
          onLogout: () => setLogoutOpen(true),
        }}
        navbar={{
          searchPlaceholder: "Search...",
          searchQuery: search.query,
          onSearchChange: search.setQuery,
          searchResults: search.results,
          onSearchSelect: search.onSelect,
          notificationCount: notifData?.unreadCount || 0,
          onNotificationsClick: () => router.push("/customer/notifications"),
          onHelpClick: () => {
            window.location.href = "mailto:support@goyalprojects.com";
          },
          showDate: false,
        }}
      >
        <CustomerProjectSwitcher />
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
