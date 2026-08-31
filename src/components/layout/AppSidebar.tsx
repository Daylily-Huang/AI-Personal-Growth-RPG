"use client";

import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Scroll,
  Sparkles,
  Network,
  FolderGit2,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "仪表盘",
    icon: LayoutDashboard,
  },
  {
    href: "/quests",
    label: "任务志",
    icon: Scroll,
  },
  {
    href: "/skills",
    label: "技能谱",
    icon: Sparkles,
  },
  {
    href: "/knowledge",
    label: "知识图",
    icon: Network,
  },
  {
    href: "/artifacts",
    label: "产出台",
    icon: FolderGit2,
    disabled: true,
    badge: "阶段7C",
  },
];

export interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  playerLevel?: number;
  userEmail?: string | null;
  className?: string;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  playerLevel,
  userEmail,
  className = "",
}: AppSidebarProps) {
  const pathname = usePathname();

  // Keyboard shortcut Ctrl/Cmd + B for sidebar collapse
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        onToggleCollapse();
      }
    },
    [onToggleCollapse]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : "游";

  return (
    <aside
      aria-label="主要导航"
      data-testid="app-sidebar"
      data-collapsed={collapsed}
      className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-[var(--z-app-shell)] bg-[var(--surface-base)] backdrop-blur-[var(--glass-blur-lg)] border-r border-[var(--border-subtle)] transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-in-out-subtle)] select-none ${
        collapsed
          ? "w-[var(--sidebar-width-collapsed)]"
          : "w-[var(--sidebar-width-expanded)]"
      } ${className}`}
    >
      {/* Brand Header */}
      <div className="h-[var(--header-height)] flex items-center justify-between px-4 border-b border-[var(--border-subtle)]">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] rounded-[var(--radius-sm)]"
          aria-label="AI Personal Growth RPG 首页"
        >
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-raised)] flex items-center justify-center shrink-0 text-[var(--gold-400)]">
            <Shield className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-serif font-[var(--font-weight-semibold)] text-sm tracking-[var(--tracking-wide)] text-[var(--text-primary)] truncate">
                AI Personal Growth
              </span>
              <span className="text-[10px] text-[var(--text-muted)] tracking-wider">
                RPG WORKSPACE
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                data-testid={`nav-item-disabled-${item.label}`}
                title={collapsed ? `${item.label} (${item.badge})` : undefined}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] min-h-[var(--touch-target-min)] text-[var(--text-disabled)] cursor-not-allowed opacity-60 ${
                  collapsed ? "justify-center" : ""
                }`}
                aria-disabled="true"
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && (
                  <div className="flex items-center justify-between flex-1 truncate">
                    <span className="text-sm font-[var(--font-weight-medium)] truncate">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-item-${item.href.slice(1)}`}
              data-active={isActive}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] min-h-[var(--touch-target-min)] transition-colors duration-[var(--duration-fast)] ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-[var(--selection-neutral-bg)] border border-[var(--selection-neutral-border)] text-[var(--selection-neutral-text)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)]"
              }`}
            >
              {/* Neutral Active Indicator Bar */}
              {isActive && (
                <div
                  data-testid="nav-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[var(--indicator-width-active)] h-5 rounded-r bg-[var(--selection-neutral-indicator)]"
                />
              )}
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? "text-[var(--selection-neutral-text)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                }`}
              />
              {!collapsed && (
                <span className="text-sm font-[var(--font-weight-medium)] truncate">
                  {item.label}
                </span>
              )}
              {collapsed && (
                <span className="sr-only">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer & User Summary & Collapse Action */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-2">
        {/* User Identity & Level Badge Minimal Capsule */}
        <div
          data-testid="sidebar-identity-capsule"
          className={`flex items-center gap-2 p-1.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div
            data-testid="user-monogram-avatar"
            className="w-7 h-7 rounded-full bg-[var(--surface-overlay)] border border-[var(--border-raised)] text-[var(--text-primary)] text-xs font-[var(--font-weight-semibold)] flex items-center justify-center shrink-0"
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {userEmail || "修行者"}
              </span>
              {typeof playerLevel === "number" && (
                <span
                  data-testid="sidebar-player-level"
                  className="text-[11px] font-mono font-[var(--font-weight-semibold)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                >
                  LV.{playerLevel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Collapse / Expand Toggle Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          data-testid="sidebar-toggle-button"
          aria-label={collapsed ? "展开导航 (Ctrl+B)" : "折叠导航 (Ctrl+B)"}
          aria-expanded={!collapsed}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-[var(--radius-md)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] min-h-[var(--touch-target-min)] transition-colors duration-[var(--duration-fast)]"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>折叠导航</span>
              <kbd className="ml-auto text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--surface-ground)] text-[var(--text-disabled)]">
                Ctrl+B
              </kbd>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
