"use client";

import React, { forwardRef } from "react";

export interface LevelBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-[10px] leading-3 min-w-[2.25rem]",
  md: "px-2.5 py-1 text-xs leading-4 min-w-[2.75rem]",
  lg: "px-3.5 py-1.5 text-sm leading-5 min-w-[3.5rem]",
};

export const LevelBadge = forwardRef<HTMLSpanElement, LevelBadgeProps>(
  ({ level, size = "md", className = "", ...props }, ref) => {
    // Defensive normalization: guarantee positive integer
    const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;

    return (
      <span
        ref={ref}
        data-testid="level-badge"
        data-level={safeLevel}
        aria-label={`玩家等级 LV.${safeLevel}`}
        title={`LV.${safeLevel}`}
        className={`inline-flex items-center justify-center font-mono font-[var(--font-weight-bold)] text-[var(--gold-400)] bg-[var(--surface-raised)] border border-[var(--gold-400)]/60 rounded-[var(--radius-sm)] shadow-[var(--glow-gold-subtle)] text-center select-none truncate ${sizeClasses[size]} ${className}`}
        {...props}
      >
        LV.{safeLevel}
      </span>
    );
  }
);

LevelBadge.displayName = "LevelBadge";
