"use client";

import React from "react";

export interface AppWorkspaceProps {
  children: React.ReactNode;
  fullBleed?: boolean;
  className?: string;
}

export function AppWorkspace({
  children,
  fullBleed = false,
  className = "",
}: AppWorkspaceProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-testid="app-workspace"
      data-full-bleed={fullBleed}
      className={`flex-1 min-w-0 transition-all duration-[var(--duration-normal)] focus:outline-none ${
        fullBleed
          ? "w-full h-full p-0 overflow-hidden"
          : "w-full max-w-[var(--workspace-max-width)] mx-auto p-4 md:p-6 lg:p-8"
      } ${className}`}
    >
      {children}
    </main>
  );
}
