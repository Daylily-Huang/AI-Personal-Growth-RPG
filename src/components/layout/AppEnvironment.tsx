"use client";

import React from "react";
import Image from "next/image";

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
      {/* Distant Mountains Vector Silhouette */}
      <div
        data-testid="environment-artwork"
        className="absolute inset-0 w-full h-full text-[var(--bg-ink-wash)] opacity-75 flex items-end justify-center"
      >
        <Image
          src="/assets/environment/ink-landscape.svg"
          alt=""
          fill
          unoptimized
          aria-hidden="true"
          className="object-cover object-bottom"
        />
      </div>

      {/* Atmospheric Mist Veil Overlay for High Legibility */}
      <div
        data-testid="environment-veil"
        className="absolute inset-0 z-[var(--z-bg-mask)] bg-[var(--bg-veil-overlay)]"
      />
    </div>
  );
}
