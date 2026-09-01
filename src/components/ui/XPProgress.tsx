"use client";

import React, { forwardRef } from "react";

export interface XPProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  current: number; // xpIntoLevel
  max: number; // xpNeededForNext
  progress?: number; // Optional 0.00 to 1.00 override
  showReadout?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: { track: "h-1", text: "text-[10px]" },
  md: { track: "h-[var(--progress-track-height)]", text: "text-xs" },
  lg: { track: "h-2.5", text: "text-sm" },
};

export const XPProgress = forwardRef<HTMLDivElement, XPProgressProps>(
  (
    {
      current,
      max,
      progress: progressOverride,
      showReadout = true,
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    // Safe normalization
    const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
    const safeMax = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;

    let percentage = 0;
    if (typeof progressOverride === "number" && Number.isFinite(progressOverride)) {
      percentage = Math.min(100, Math.max(0, Math.round(progressOverride * 100)));
    } else if (safeMax > 0) {
      percentage = Math.min(100, Math.max(0, Math.round((safeCurrent / safeMax) * 100)));
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
        aria-valuenow={safeCurrent}
        aria-valuemin={0}
        aria-valuemax={safeMax}
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
          className={`w-full rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] overflow-hidden ${track}`}
        >
          <div
            data-testid="xp-progress-bar"
            style={{ width: `${percentage}%` }}
            className="h-full bg-[var(--gold-400)] rounded-full transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out-gentle)] shadow-[var(--glow-gold-subtle)]"
          />
        </div>
      </div>
    );
  }
);

XPProgress.displayName = "XPProgress";
