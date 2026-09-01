"use client";

import React, { forwardRef } from "react";
import { Gem } from "lucide-react";

export interface ReusabilityMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  score: number; // 0.00 to 1.00
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const ReusabilityMeter = forwardRef<HTMLDivElement, ReusabilityMeterProps>(
  (
    {
      score,
      showLabel = true,
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    // Safe normalization between 0.00 and 1.00
    const safeScore = Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
    const percentage = Math.round(safeScore * 100);

    const trackHeight = size === "sm" ? "h-1.5" : "h-2";

    return (
      <div
        ref={ref}
        data-testid="reusability-meter"
        data-score={safeScore}
        role="progressbar"
        aria-valuenow={safeScore}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuetext={`复用价值: ${percentage}%`}
        className={`flex flex-col gap-1 w-full ${className}`}
        {...props}
      >
        {showLabel && (
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              <Gem className="w-3 h-3 text-[var(--entity-artifact-text)]" aria-hidden="true" />
              复用指数
            </span>
            <span
              data-testid="reusability-meter-value"
              className="font-[var(--font-weight-semibold)] text-[var(--entity-artifact-text)]"
            >
              {safeScore.toFixed(2)}
            </span>
          </div>
        )}

        <div
          data-testid="reusability-meter-track"
          className={`w-full rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] overflow-hidden ${trackHeight}`}
        >
          <div
            data-testid="reusability-meter-bar"
            style={{ width: `${percentage}%` }}
            className="h-full bg-[var(--entity-artifact-text)] rounded-full transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out-gentle)]"
          />
        </div>
      </div>
    );
  }
);

ReusabilityMeter.displayName = "ReusabilityMeter";
