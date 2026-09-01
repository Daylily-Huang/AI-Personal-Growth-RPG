"use client";

import React, { forwardRef } from "react";

export interface LevelBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3.5 py-1.5 text-sm",
};

export const LevelBadge = forwardRef<HTMLSpanElement, LevelBadgeProps>(
  ({ level, size = "md", className = "", ...props }, ref) => {
    // Defensive normalization: guarantee positive integer >= 1
    const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;

    return (
      <span
        ref={ref}
        data-testid="level-badge"
        data-shape="octagonal-seal"
        data-level={safeLevel}
        aria-label={`玩家等级 LV.${safeLevel}`}
        title={`LV.${safeLevel}`}
        className={`relative inline-flex items-center justify-center font-mono font-[var(--font-weight-bold)] text-[var(--gold-400)] bg-[var(--surface-raised)] border border-[var(--border-gold-strong)] shadow-[var(--glow-gold-subtle)] text-center select-none truncate [clip-path:polygon(25%_0%,75%_0%,100%_25%,100%_75%,75%_100%,25%_100%,0%_75%,0%_25%)] ${sizeClasses[size]} ${className}`}
        {...props}
      >
        LV.{safeLevel}
      </span>
    );
  }
);

LevelBadge.displayName = "LevelBadge";
