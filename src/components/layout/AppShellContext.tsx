"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { DashboardSnapshot } from "@/lib/store/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface DashboardRefreshResult {
  ok: boolean;
  status?: number;
  error?: string;
  dashboard?: DashboardSnapshot;
}

export interface AppShellContextValue {
  dashboard: DashboardSnapshot | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  setDashboard: React.Dispatch<React.SetStateAction<DashboardSnapshot | null>>;
  refreshDashboard: () => Promise<DashboardRefreshResult>;
  userEmail: string | null;
  setUserEmail: React.Dispatch<React.SetStateAction<string | null>>;
  desktopCollapsed: boolean;
  setDesktopCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  // Backward compatibility aliases
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

/**
 * Strict hook for components that require AppShellProvider.
 * Throws an error if used outside AppShellProvider.
 */
export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return ctx;
}

/**
 * Optional hook that safely returns AppShellContextValue or null without throwing.
 * Zero try/catch and zero rule-of-hooks suppression.
 */
export function useOptionalAppShell(): AppShellContextValue | null {
  return useContext(AppShellContext);
}

export interface AppShellProviderProps {
  children: React.ReactNode;
  initialDashboard?: DashboardSnapshot | null;
  initialUserEmail?: string | null;
}

export function AppShellProvider({
  children,
  initialDashboard = null,
  initialUserEmail = null,
}: AppShellProviderProps) {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(initialDashboard);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(!initialDashboard);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(initialUserEmail);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const refreshDashboard = useCallback(async (): Promise<DashboardRefreshResult> => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await fetch("/api/dashboard");
      if (res.status === 401) {
        setDashboard(null);
        setDashboardError("unauthenticated");
        setDashboardLoading(false);
        return { ok: false, status: 401, error: "unauthenticated" };
      }
      if (!res.ok) {
        const msg = `Failed to load dashboard: ${res.status}`;
        setDashboard(null);
        setDashboardError(msg);
        setDashboardLoading(false);
        return { ok: false, status: res.status, error: msg };
      }
      const data = await res.json();
      if (data.dashboard) {
        setDashboard(data.dashboard);
        setDashboardError(null);
        setDashboardLoading(false);
        return { ok: true, status: 200, dashboard: data.dashboard };
      }
      setDashboardLoading(false);
      return { ok: true, status: 200 };
    } catch (e) {
      const err = e instanceof Error ? e.message : "Unknown error";
      setDashboard(null);
      setDashboardError(err);
      setDashboardLoading(false);
      return { ok: false, error: err };
    }
  }, []);

  // Fetch initial dashboard ONCE only if initialDashboard was NOT provided
  useEffect(() => {
    if (initialDashboard) {
      return;
    }

    let ignore = false;
    async function loadInitial() {
      const res = await refreshDashboard();
      if (ignore) return;
      if (res.status === 401) {
        setDashboardError("unauthenticated");
      }
    }

    void loadInitial();
    return () => {
      ignore = true;
    };
  }, [initialDashboard, refreshDashboard]);

  // Resolve session email if configured
  useEffect(() => {
    if (userEmail) return;

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseBrowserClient();
        client.auth.getUser().then(({ data }) => {
          if (data?.user?.email) {
            setUserEmail(data.user.email);
          }
        }).catch(() => {});
      } catch {
        // Graceful fallback
      }
    }
  }, [userEmail]);

  const toggleSidebar = useCallback(() => {
    setDesktopCollapsed((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      dashboard,
      dashboardLoading,
      dashboardError,
      setDashboard,
      refreshDashboard,
      userEmail,
      setUserEmail,
      desktopCollapsed,
      setDesktopCollapsed,
      toggleSidebar,
      // Backward compatibility aliases
      sidebarCollapsed: desktopCollapsed,
      setSidebarCollapsed: setDesktopCollapsed,
    }),
    [
      dashboard,
      dashboardLoading,
      dashboardError,
      refreshDashboard,
      userEmail,
      desktopCollapsed,
      toggleSidebar,
    ]
  );

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}
