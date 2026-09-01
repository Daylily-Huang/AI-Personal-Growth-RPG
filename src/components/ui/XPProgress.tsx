"use client";

import React, { forwardRef } from "react";

export interface XPProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  current: number; // xpIntoLevel
  max: number; // xpNeededForNext
  showReadout?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: { track: "h-1", text: "text-xs" },
  md: { track: "h-[var(--progress-track-height)]", text: "text-xs" },
  lg: { track: "h-2.5", text: "text-sm" },
};

export const XPProgress = forwardRef<HTMLDivElement, XPProgressProps>(
  (
    {
      current,
      max,
      showReadout = true,
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    // Safe normalization: keep actual integer values for text readout
    const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
    const safeMax = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;

    // Derive one coherent normalized percentage (0 to 100)
    let percentage = 0;
    if (safeMax > 0) {
      if (safeCurrent >= safeMax) {
        percentage = 100;
      } else {
        percentage = Math.min(100, Math.max(0, Math.round((safeCurrent / safeMax) * 100)));
      }
    }

    const { track, text } = sizeClasses[size];

    return (
      <div
        ref={ref}
        data-testid="xp-progress"
        data-current={safeCurrent}
        data-max={safeMax}
        data-percentage={percentage}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${safeCurrent} / ${safeMax} XP (${percentage}%)`}
        className={`flex flex-col gap-1 w-full ${className}`}
        {...props}
      >
        {showReadout && (
          <div
            data-testid="xp-progress-readout"
            className={`flex items-center justify-between font-mono text-[var(--text-muted)] ${text}`}
          >
            <span data-testid="xp-progress-current">{safeCurrent}</span>
            <span className="opacity-60">/</span>
            <span data-testid="xp-progress-max">{safeMax} XP</span>
          </div>
        )}

        <div
          data-testid="xp-progress-track"
          className={`w-full rounded-full bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)] overflow-hidden ${track}`}
        >
          <div
            data-testid="xp-progress-bar"
            style={{ width: `${percentage}%` }}
            className="h-full bg-gradient-to-r from-[var(--gold-500)] to-[var(--gold-300)] rounded-full transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out-gentle)] shadow-[var(--glow-gold-subtle)]"
          />
        </div>
      </div>
    );
  }
);

XPProgress.displayName = "XPProgress";
