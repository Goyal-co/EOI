"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/utils";
import { brand } from "../tokens";
import { ChevronLeft, LogOut, Settings, X, type LucideIcon } from "lucide-react";
import { Portal } from "./portal";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export interface SidebarProps {
  items: SidebarItem[];
  logo?: React.ReactNode;
  title?: string;
  subtitle?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  profile?: {
    name: string;
    role: string;
    avatar?: string;
  };
  onLogout?: () => void;
  onSettingsClick?: () => void;
  className?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function SidebarInner({
  items,
  logo,
  title = brand.appName,
  subtitle,
  collapsed = false,
  onToggleCollapse,
  profile,
  onLogout,
  onSettingsClick,
  onNavigate,
  showClose,
  onClose,
}: SidebarProps & { onNavigate?: () => void; showClose?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-4">
        {logo || (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-hover text-sm font-bold text-white">
            G
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {showClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-blue-50 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {onToggleCollapse && !showClose && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "ml-auto hidden shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground lg:flex",
              collapsed && "mx-auto"
            )}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-foreground shadow-sm ring-1 ring-blue-100"
                  : "text-muted-foreground hover:bg-blue-50/80 hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-gold")} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {profile && (
        <div className="shrink-0 border-t border-border/60 p-3">
          <div className={cn("flex items-center gap-3 rounded-lg p-2", collapsed && "justify-center")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
              {profile.avatar || profile.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{profile.name}</p>
                <p className="truncate text-xs font-medium text-gold">{profile.role}</p>
              </div>
            )}
          </div>
          {onSettingsClick && (
            <button
              type="button"
              onClick={onSettingsClick}
              aria-label="Settings"
              className={cn(
                "mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground",
                collapsed && "justify-center"
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed && "Settings"}
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className={cn(
                "mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-red-50 hover:text-error",
                collapsed && "justify-center"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && "Logout"}
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  const { collapsed, mobileOpen, onMobileClose, className } = props;

  return (
    <>
      {/* Mobile drawer — overlay, never affects document flow */}
      {mobileOpen && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] bg-navy/50 backdrop-blur-[2px] lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-[110] flex w-[min(280px,88vw)] flex-col bg-surface shadow-modal lg:hidden",
              "animate-in slide-in-from-left duration-200",
              className
            )}
            aria-label="Mobile navigation"
          >
            <SidebarInner
              {...props}
              collapsed={false}
              onNavigate={onMobileClose}
              showClose
              onClose={onMobileClose}
            />
          </aside>
        </Portal>
      )}

      {/* Desktop sidebar — always in document flow */}
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col bg-surface shadow-[1px_0_0_0_rgba(226,232,240,0.8)] transition-[width] duration-300 lg:flex",
          collapsed ? "w-[72px]" : "w-[264px]",
          className
        )}
        aria-label="Main navigation"
      >
        <SidebarInner {...props} />
      </aside>
    </>
  );
}
