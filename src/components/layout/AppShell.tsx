"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AppEnvironment } from "./AppEnvironment";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { AppWorkspace } from "./AppWorkspace";
import { MobileNav } from "./MobileNav";
import type { DashboardSnapshot } from "@/lib/store/types";
import { useAppShell } from "./AppShellContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface AppShellProps {
  children: React.ReactNode;
  dashboard?: DashboardSnapshot | null;
  userEmail?: string | null;
  onLogout?: () => void;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  fullBleed?: boolean;
  className?: string;
}

export function AppShell({
  children,
  dashboard: propDashboard,
  userEmail: propUserEmail,
  onLogout: customOnLogout,
  title,
  breadcrumbs,
  fullBleed = false,
  className = "",
}: AppShellProps) {
  const router = useRouter();

  // Try reading shared context if mounted under AppShellProvider
  let shellCtx: ReturnType<typeof useAppShell> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    shellCtx = useAppShell();
  } catch {
    // Fallback if rendered outside provider in standalone test
  }

  const [localCollapsed, setLocalCollapsed] = useState(false);

  const sidebarCollapsed = shellCtx ? shellCtx.sidebarCollapsed : localCollapsed;
  const toggleSidebar = shellCtx
    ? shellCtx.toggleSidebar
    : () => setLocalCollapsed((prev) => !prev);

  // Derived effective state: props override shared context, which in turn holds latest snapshot
  const dashboard = propDashboard !== undefined ? propDashboard : (shellCtx ? shellCtx.dashboard : null);
  const userEmail = propUserEmail !== undefined ? propUserEmail : (shellCtx ? shellCtx.userEmail : null);

  const handleLogout = customOnLogout || (async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      if (isSupabaseConfigured()) {
        const client = getSupabaseBrowserClient();
        await client.auth.signOut();
      }
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  });

  const playerLevel = dashboard?.player?.playerLevel;

  return (
    <div
      data-testid="app-shell-root"
      className={`min-h-screen relative flex flex-col bg-[var(--bg-deep-void)] text-[var(--text-primary)] font-sans antialiased ${className}`}
    >
      {/* 1. Global Environmental Background + Veil */}
      <AppEnvironment />

      {/* 2. Desktop Navigation Sidebar (CSS-first responsive structure) */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        playerLevel={playerLevel}
        userEmail={userEmail}
      />

      {/* Main Content Area (CSS-first offset by Sidebar on md/lg and MobileNav on base) */}
      <div
        data-testid="app-shell-content-container"
        className={`flex-1 flex flex-col transition-[margin-left] duration-[var(--duration-normal)] ease-[var(--ease-in-out-subtle)] pb-[var(--mobile-nav-height)] md:pb-0 ${
          sidebarCollapsed
            ? "md:ml-[var(--sidebar-width-collapsed)]"
            : "md:ml-[var(--sidebar-width-collapsed)] lg:ml-[var(--sidebar-width-expanded)]"
        }`}
      >
        {/* 3. Global Top Header */}
        <AppHeader
          title={title}
          breadcrumbs={breadcrumbs}
          dashboard={dashboard}
          userEmail={userEmail}
          onLogout={handleLogout}
        />

        {/* 4. Main Workspace */}
        <AppWorkspace fullBleed={fullBleed}>
          {children}
        </AppWorkspace>
      </div>

      {/* 5. Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
