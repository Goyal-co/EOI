"use client";

import { Search, Bell, HelpCircle, Plus, Menu } from "lucide-react";
import { Button } from "./button";
import { Badge } from "./badge";

export interface NavbarProps {
  searchPlaceholder?: string;
  notificationCount?: number;
  pendingApprovals?: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchResults?: Array<{ type: string; id: string; label: string; href: string }>;
  onSearchSelect?: (href: string) => void;
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  onQuickAction?: () => void;
  quickActionLabel?: string;
  showDate?: boolean;
  profileName?: string;
  profileRole?: string;
  onProfileClick?: () => void;
  onMenuClick?: () => void;
  children?: React.ReactNode;
}

export function Navbar({
  searchPlaceholder = "Search...",
  notificationCount = 0,
  pendingApprovals,
  searchQuery = "",
  onSearchChange,
  searchResults = [],
  onSearchSelect,
  onNotificationsClick,
  onHelpClick,
  onQuickAction,
  quickActionLabel = "Add Project",
  showDate = true,
  profileName,
  profileRole,
  onProfileClick,
  onMenuClick,
  children,
}: NavbarProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-surface/95 shadow-navbar backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-4 lg:gap-3 lg:px-6">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {onSearchChange && (
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              aria-label="Search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-blue-50/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-card">
                {searchResults.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50"
                    onClick={() => onSearchSelect?.(r.href)}
                  >
                    <span className="truncate text-foreground">{r.label}</span>
                    <span className="shrink-0 text-xs capitalize text-muted-foreground">{r.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {children}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {showDate && (
            <div className="hidden text-right xl:block">
              <p className="text-sm font-medium text-foreground">{dateStr}</p>
              <p className="text-xs text-muted-foreground">{timeStr}</p>
            </div>
          )}

          {pendingApprovals !== undefined && pendingApprovals > 0 && (
            <Badge variant="gold">{pendingApprovals} Pending</Badge>
          )}

          {onNotificationsClick && (
            <button
              type="button"
              onClick={onNotificationsClick}
              aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
              className="relative shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
                  {notificationCount}
                </span>
              )}
            </button>
          )}

          {onProfileClick && profileName && (
            <button
              type="button"
              onClick={onProfileClick}
              aria-label="Profile"
              className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                {profileName.charAt(0)}
              </div>
              <div className="hidden text-left sm:block">
                <p className="max-w-[120px] truncate text-sm font-medium text-foreground">{profileName}</p>
                {profileRole && <p className="max-w-[120px] truncate text-[10px] text-gold">{profileRole}</p>}
              </div>
            </button>
          )}

          {onHelpClick && (
            <button
              type="button"
              onClick={onHelpClick}
              aria-label="Help"
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          )}

          {onQuickAction && (
            <Button variant="gold" size="sm" onClick={onQuickAction} className="shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{quickActionLabel}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
