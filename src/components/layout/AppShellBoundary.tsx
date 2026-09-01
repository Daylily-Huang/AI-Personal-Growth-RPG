"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";
import { AppShellProvider } from "./AppShellContext";

export const PRODUCT_ROUTE_PREFIXES = [
  "/dashboard",
  "/quests",
  "/skills",
  "/knowledge",
  "/artifacts",
] as const;

/**
 * Segment-safe product route classifier.
 * Matches known product routes and their subpaths (/dashboard, /quests/123, etc.)
 * while keeping non-product routes (/login, /, /api/*, unknown public paths) outside the shell.
 */
export function isProductRoute(pathname: string): boolean {
  return PRODUCT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export interface AppShellBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global AppShell Boundary for the Application.
 * Preserves a single, persistent AppShell instance across all authenticated product
 * routes (/dashboard, /quests, /skills, /knowledge, /artifacts), ensuring sidebar collapse
 * state and session data are NOT reset on navigation, while cleanly excluding /login and public routes.
 */
export function AppShellBoundary({ children }: AppShellBoundaryProps) {
  const pathname = usePathname();

  // Non-product routes remain completely outside the authenticated application shell
  if (!isProductRoute(pathname)) {
    return <>{children}</>;
  }

  // Full-bleed workspace mode for graph/tree canvases
  const isFullBleed = pathname === "/skills" || pathname.startsWith("/skills/") || pathname === "/knowledge" || pathname.startsWith("/knowledge/");

  return (
    <AppShellProvider>
      <AppShell fullBleed={isFullBleed}>
        {children}
      </AppShell>
    </AppShellProvider>
  );
}
