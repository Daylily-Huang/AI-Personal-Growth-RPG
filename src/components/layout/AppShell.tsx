"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppEnvironment } from "./AppEnvironment";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { AppWorkspace } from "./AppWorkspace";
import { MobileNav } from "./MobileNav";
import type { DashboardSnapshot } from "@/lib/store/types";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userToggled, setUserToggled] = useState(false);
  const [fetchedDashboard, setFetchedDashboard] = useState<DashboardSnapshot | null>(null);
  const [fetchedUserEmail, setFetchedUserEmail] = useState<string | null>(null);

  // Responsive sidebar collapse contract: md (tablet) defaults to collapsed, lg (desktop) defaults to expanded
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function" || userToggled) return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateResponsiveSidebar = () => {
      if (!userToggled) {
        setSidebarCollapsed(!mediaQuery.matches);
      }
    };

    updateResponsiveSidebar();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateResponsiveSidebar);
      return () => mediaQuery.removeEventListener("change", updateResponsiveSidebar);
    }
  }, [userToggled]);

  // Derived effective state (props take precedence over fetched fallback)
  const dashboard = propDashboard ?? fetchedDashboard;
  const userEmail = propUserEmail ?? fetchedUserEmail;

  // If dashboard is not passed as prop, fetch from /api/dashboard once on mount
  useEffect(() => {
    if (propDashboard) return;

    let ignore = false;
    async function loadDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.dashboard) {
            setFetchedDashboard(data.dashboard);
          }
        }
      } catch {
        // Degrade gracefully if offline or unauthenticated
      }
    }

    void loadDashboard();
    return () => {
      ignore = true;
    };
  }, [propDashboard]);

  // If userEmail is not passed as prop, resolve from Supabase session if configured
  useEffect(() => {
    if (propUserEmail) return;

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseBrowserClient();
        client.auth.getUser().then(({ data }) => {
          if (data?.user?.email) {
            setFetchedUserEmail(data.user.email);
          }
        }).catch(() => {});
      } catch {
        // Graceful fallback
      }
    }
  }, [propUserEmail]);

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

  const toggleSidebar = () => {
    setUserToggled(true);
    setSidebarCollapsed((prev) => !prev);
  };

  const playerLevel = dashboard?.player?.playerLevel;

  return (
    <div
      data-testid="app-shell-root"
      className={`min-h-screen relative flex flex-col bg-[var(--bg-deep-void)] text-[var(--text-primary)] font-sans antialiased ${className}`}
    >
      {/* 1. Global Environmental Background + Veil */}
      <AppEnvironment />

      {/* 2. Desktop Navigation Sidebar */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        playerLevel={playerLevel}
        userEmail={userEmail}
      />

      {/* Main Content Area (Offset by Sidebar on md/lg and MobileNav on base) */}
      <div
        data-testid="app-shell-content-container"
        className={`flex-1 flex flex-col transition-[margin-left] duration-[var(--duration-normal)] ease-[var(--ease-in-out-subtle)] pb-[var(--mobile-nav-height)] md:pb-0 ${
          sidebarCollapsed
            ? "md:ml-[var(--sidebar-width-collapsed)]"
            : "md:ml-[var(--sidebar-width-expanded)]"
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
