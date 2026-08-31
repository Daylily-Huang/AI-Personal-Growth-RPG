"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Sparkles, User } from "lucide-react";
import type { DashboardSnapshot } from "@/lib/store/types";
import { useOptionalAppShell } from "./AppShellContext";

export interface AppHeaderProps {
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  dashboard?: DashboardSnapshot | null;
  userEmail?: string | null;
  onLogout?: () => void;
  className?: string;
}

const ROUTE_NAME_MAP: Record<string, string> = {
  "/dashboard": "仪表盘",
  "/quests": "任务志",
  "/skills": "技能谱",
  "/knowledge": "知识图",
  "/artifacts": "产出台",
};

export function AppHeader({
  title,
  breadcrumbs,
  dashboard: propDashboard,
  userEmail: propUserEmail,
  onLogout,
  className = "",
}: AppHeaderProps) {
  const pathname = usePathname();

  const shellCtx = useOptionalAppShell();

  const dashboard = propDashboard !== undefined ? propDashboard : (shellCtx ? shellCtx.dashboard : null);
  const userEmail = propUserEmail !== undefined ? propUserEmail : (shellCtx ? shellCtx.userEmail : null);

  // Resolve current title from prop or route map
  const displayTitle = title || ROUTE_NAME_MAP[pathname] || "工作区";

  const resolvedBreadcrumbs = breadcrumbs || [
    { label: "AI RPG", href: "/dashboard" },
    { label: displayTitle },
  ];

  const pendingAssessmentsCount =
    dashboard?.pendingAssessments && Array.isArray(dashboard.pendingAssessments)
      ? dashboard.pendingAssessments.length
      : 0;

  const playerLevel = dashboard?.player?.playerLevel;
  const levelProgress = dashboard?.levelProgress;
  const totalXp = dashboard?.player?.totalXp;

  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : "游";

  return (
    <header
      data-testid="app-header"
      className={`sticky top-0 z-[var(--z-header)] h-[var(--header-height)] bg-[var(--surface-base)] backdrop-blur-[var(--glass-blur-md)] border-b border-[var(--border-subtle)] flex items-center justify-between px-4 lg:px-8 select-none ${className}`}
    >
      {/* Left: Title & Desktop-only Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          {/* Breadcrumbs Navigation — Hidden below lg, visible on lg and above per frozen contract */}
          <nav
            aria-label="页面路径"
            data-testid="header-breadcrumbs"
            className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
          >
            {resolvedBreadcrumbs.map((crumb, idx) => {
              const isLast = idx === resolvedBreadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <ChevronRight className="w-3 h-3 text-[var(--text-disabled)] shrink-0" />
                  )}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-[var(--text-primary)] transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[var(--text-secondary)] font-[var(--font-weight-medium)] truncate">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Section Title in Song-Serif + Tablet Level Badge / Placeholder */}
          <div className="flex items-center gap-2 truncate">
            <h1
              data-testid="header-page-title"
              className="font-serif font-[var(--font-weight-semibold)] text-base lg:text-lg text-[var(--text-primary)] tracking-[var(--tracking-wide)] truncate"
            >
              {displayTitle}
            </h1>

            {/* Tablet (md) Level Badge or Zero-CLS Skeleton */}
            {typeof playerLevel === "number" ? (
              <span
                data-testid="header-tablet-level-badge"
                className="hidden md:inline-block lg:hidden font-mono font-[var(--font-weight-bold)] text-xs text-[var(--text-primary)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-raised)]"
              >
                LV.{playerLevel}
              </span>
            ) : (
              <span
                data-testid="header-tablet-level-skeleton"
                aria-hidden="true"
                className="hidden md:inline-block lg:hidden w-11 h-5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-raised)] animate-pulse"
              />
            )}
          </div>
        </div>
      </div>

      {/* Right: Progression Meter, Pending Indicator & User Identity */}
      <div className="flex items-center gap-3 lg:gap-5 shrink-0">
        {/* Pending Assessment Indicator (Compact icon+number below lg; verbose on lg+) */}
        {pendingAssessmentsCount > 0 && (
          <div
            data-testid="pending-assessment-indicator"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--state-warning-bg)] border border-[var(--state-warning-border)] text-[var(--state-warning-text)] text-xs font-[var(--font-weight-medium)] animate-pulse"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:inline">{pendingAssessmentsCount} 待确认评估</span>
            <span className="lg:hidden font-mono font-bold">{pendingAssessmentsCount}</span>
          </div>
        )}

        {/* Desktop (lg/xl) Full Progression Capsule or Zero-CLS Skeleton */}
        {typeof playerLevel === "number" && levelProgress ? (
          <div
            data-testid="header-progression-capsule"
            className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)]"
          >
            {/* Level Readout */}
            <span
              data-testid="header-player-level"
              className="font-mono font-[var(--font-weight-bold)] text-xs text-[var(--text-primary)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-raised)]"
            >
              LV.{playerLevel}
            </span>

            {/* XP Progress Bar & Numerical Readout */}
            <div className="flex flex-col gap-1 w-28 lg:w-36">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                <span data-testid="header-xp-into-level">{levelProgress.xpIntoLevel}</span>
                <span>/</span>
                <span data-testid="header-xp-needed">{levelProgress.xpNeededForNext} XP</span>
              </div>
              <div
                data-testid="header-xp-track"
                className="w-full h-[var(--progress-track-height)] rounded-full bg-[var(--surface-raised)] overflow-hidden"
              >
                <div
                  data-testid="header-xp-bar"
                  style={{ width: `${Math.min(100, Math.max(0, Math.round(levelProgress.progress * 100)))}%` }}
                  className="h-full bg-[var(--gold-400)] rounded-full transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out-gentle)]"
                />
              </div>
            </div>

            {/* Optional Total XP on xl */}
            {typeof totalXp === "number" && (
              <span
                data-testid="header-total-xp"
                className="hidden xl:inline-block text-xs font-mono text-[var(--text-secondary)] pl-1 border-l border-[var(--border-subtle)]"
              >
                总 {totalXp}
              </span>
            )}
          </div>
        ) : (
          <div
            data-testid="header-progression-skeleton"
            aria-hidden="true"
            className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)]"
          >
            <div className="w-9 h-5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] animate-pulse" />
            <div className="flex flex-col gap-1 w-28 lg:w-36">
              <div className="w-16 h-3 rounded bg-[var(--surface-raised)] animate-pulse" />
              <div className="w-full h-[var(--progress-track-height)] rounded-full bg-[var(--surface-raised)]" />
            </div>
          </div>
        )}

        {/* User Identity Avatar Capsule */}
        <div
          data-testid="header-user-capsule"
          className="flex items-center gap-2 pl-2"
        >
          <div
            data-testid="header-user-avatar"
            className="w-8 h-8 rounded-full bg-[var(--surface-raised)] border border-[var(--border-raised)] text-[var(--text-primary)] text-xs font-[var(--font-weight-semibold)] flex items-center justify-center select-none"
            title={userEmail || "用户"}
          >
            {initials ? initials : <User className="w-4 h-4 text-[var(--text-muted)]" />}
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              data-testid="header-logout-button"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--state-danger-text)] transition-colors min-h-[var(--touch-target-min)] px-2"
            >
              登出
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
