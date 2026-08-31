"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { DashboardSnapshot } from "@/lib/store/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface AppShellContextValue {
  dashboard: DashboardSnapshot | null;
  setDashboard: React.Dispatch<React.SetStateAction<DashboardSnapshot | null>>;
  refreshDashboard: () => Promise<void>;
  userEmail: string | null;
  setUserEmail: React.Dispatch<React.SetStateAction<string | null>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return ctx;
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
  const [userEmail, setUserEmail] = useState<string | null>(initialUserEmail);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const refreshDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        if (data.dashboard) {
          setDashboard(data.dashboard);
        }
      }
    } catch {
      // Degrade gracefully
    }
  }, []);

  // Fetch initial dashboard once if not provided
  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.dashboard) {
            setDashboard((prev) => prev ?? data.dashboard);
          }
        }
      } catch {
        // Degrade gracefully
      }
    }

    void loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

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
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      dashboard,
      setDashboard,
      refreshDashboard,
      userEmail,
      setUserEmail,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
    }),
    [dashboard, refreshDashboard, userEmail, sidebarCollapsed, toggleSidebar]
  );

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}
