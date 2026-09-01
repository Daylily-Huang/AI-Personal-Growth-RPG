"use client";

import React, { forwardRef } from "react";

export interface QuestProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  progress: number; // 0 to 100%
  showLabel?: boolean;
  milestones?: number[]; // Milestone percentage ticks, e.g. [25, 50, 75]
  size?: "sm" | "md";
  className?: string;
}

export const QuestProgress = forwardRef<HTMLDivElement, QuestProgressProps>(
  (
    {
      progress,
      showLabel = true,
      milestones = [],
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    // Safe normalization between 0 and 100
    const safePercentage = Number.isFinite(progress)
      ? Math.min(100, Math.max(0, Math.round(progress)))
      : 0;

    const trackHeight = size === "sm" ? "h-1.5" : "h-2";

    return (
      <div
        ref={ref}
        data-testid="quest-progress"
        data-progress={safePercentage}
        role="progressbar"
        aria-valuenow={safePercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`任务进度: ${safePercentage}%`}
        className={`flex flex-col gap-1 w-full ${className}`}
        {...props}
      >
        {showLabel && (
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
            <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              任务完成度
            </span>
            <span data-testid="quest-progress-percentage" className="font-[var(--font-weight-semibold)] text-[var(--entity-quest-text)]">
              {safePercentage}%
            </span>
          </div>
        )}

        <div
          data-testid="quest-progress-track"
          className={`relative w-full rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] overflow-hidden ${trackHeight}`}
        >
          {/* Milestone Ticks */}
          {milestones.map((milestone) => (
            <div
              key={milestone}
              style={{ left: `${Math.min(100, Math.max(0, milestone))}%` }}
              aria-hidden="true"
              className="absolute top-0 bottom-0 w-0.5 bg-[var(--border-raised)] z-[var(--z-canvas)] -ml-[1px]"
            />
          ))}

          {/* Azure Quest Fill */}
          <div
            data-testid="quest-progress-bar"
            style={{ width: `${safePercentage}%` }}
            className="h-full bg-[var(--entity-quest-text)] rounded-full transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out-gentle)]"
          />
        </div>
      </div>
    );
  }
);

QuestProgress.displayName = "QuestProgress";
