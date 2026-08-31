"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

export interface AppShellBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global AppShell Boundary for the Application.
 * Preserves a single, persistent AppShell instance across all authenticated product
 * routes (/dashboard, /quests, /skills, /knowledge, /artifacts), ensuring sidebar collapse
 * state and session data are NOT reset on navigation, while cleanly excluding /login.
 */
export function AppShellBoundary({ children }: AppShellBoundaryProps) {
  const pathname = usePathname();

  // /login page remains completely outside the authenticated application shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Full-bleed workspace mode for graph/tree canvases
  const isFullBleed = pathname === "/skills" || pathname === "/knowledge";

  return (
    <AppShell fullBleed={isFullBleed}>
      {children}
    </AppShell>
  );
}
