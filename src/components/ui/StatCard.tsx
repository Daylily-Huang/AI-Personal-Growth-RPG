"use client";

import React, { forwardRef } from "react";
import { GlassPanel } from "./GlassPanel";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: React.ReactNode;
  className?: string;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      label,
      value,
      subtitle,
      icon,
      trend,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <GlassPanel
        ref={ref}
        variant="base"
        border="default"
        data-testid="stat-card"
        className={`p-4 lg:p-5 flex flex-col justify-between gap-2 shadow-[var(--shadow-card)] ${className}`}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            data-testid="stat-card-label"
            className="text-xs font-[var(--font-weight-medium)] uppercase tracking-[var(--tracking-wider)] text-[var(--text-secondary)] truncate"
          >
            {label}
          </span>
          {icon && (
            <div data-testid="stat-card-icon" className="shrink-0 text-[var(--text-muted)]">
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2 my-0.5">
          <div
            data-testid="stat-card-value"
            className="text-2xl lg:text-3xl font-bold font-mono text-[var(--text-primary)] tracking-tight tabular-nums truncate"
          >
            {value}
          </div>
          {trend && (
            <div data-testid="stat-card-trend" className="shrink-0 text-xs font-mono">
              {trend}
            </div>
          )}
        </div>

        {subtitle && (
          <div
            data-testid="stat-card-subtitle"
            className="text-xs text-[var(--text-muted)] truncate"
          >
            {subtitle}
          </div>
        )}
      </GlassPanel>
    );
  }
);

StatCard.displayName = "StatCard";
