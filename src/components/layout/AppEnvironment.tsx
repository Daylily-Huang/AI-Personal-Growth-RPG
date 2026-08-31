"use client";

import React from "react";

export interface AppEnvironmentProps {
  className?: string;
}

export function AppEnvironment({ className = "" }: AppEnvironmentProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="app-environment"
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none z-[var(--z-bg-env)] bg-[var(--bg-deep-void)] ${className}`}
    >
      {/* Distant Mountains Vector Silhouette Rendered as CSS Mask with Frozen Token */}
      <div
        data-testid="environment-artwork"
        style={{
          maskImage: "url(/assets/environment/ink-landscape.svg)",
          WebkitMaskImage: "url(/assets/environment/ink-landscape.svg)",
          maskSize: "cover",
          WebkitMaskSize: "cover",
          maskPosition: "bottom center",
          WebkitMaskPosition: "bottom center",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
        className="absolute inset-0 w-full h-full bg-[var(--bg-ink-wash)] opacity-75 pointer-events-none"
      />

      {/* Atmospheric Mist Veil Overlay for High Legibility */}
      <div
        data-testid="environment-veil"
        className="absolute inset-0 z-[var(--z-bg-mask)] bg-[var(--bg-veil-overlay)]"
      />
    </div>
  );
}
