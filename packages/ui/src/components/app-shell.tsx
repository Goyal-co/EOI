"use client";

import * as React from "react";
import { Sidebar, type SidebarProps } from "./sidebar";
import { Navbar, type NavbarProps } from "./navbar";
import { cn } from "../lib/utils";

export interface AppShellProps {
  sidebar: SidebarProps;
  navbar?: NavbarProps;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ sidebar, navbar, children, className }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <Sidebar
        {...sidebar}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {navbar && (
          <Navbar
            {...navbar}
            onMenuClick={() => setMobileOpen(true)}
          />
        )}
        <main
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto overscroll-contain",
            "p-4 sm:p-6 lg:p-8",
            className
          )}
        >
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
