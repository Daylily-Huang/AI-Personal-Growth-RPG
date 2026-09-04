"use client";

import React from "react";
import { PenLine } from "lucide-react";

export interface DashboardHeaderProps {
  displayName?: string;
  onQuickLog?: () => void;
}

export function DashboardHeader({
  displayName,
  onQuickLog,
}: DashboardHeaderProps) {
  // Determine greeting based on local time
  const hour = new Date().getHours();
  let greetingTime = "晚上好";
  if (hour >= 5 && hour < 11) greetingTime = "早上好";
  else if (hour >= 11 && hour < 13) greetingTime = "中午好";
  else if (hour >= 13 && hour < 18) greetingTime = "下午好";

  const greetingTitle = displayName ? `${greetingTime}，${displayName}` : greetingTime;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
      {/* Left: Greeting (h2 to respect single page-level h1 from AppHeader) */}
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {greetingTitle}
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 font-sans">
          从真实行动出发，持续沉淀你的成长轨迹。
        </p>
      </div>

      {/* Right: Action CTA strictly matching behavior */}
      {onQuickLog && (
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onQuickLog}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[var(--touch-target-min)] rounded-xl text-xs sm:text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)] bg-[var(--surface-base)] hover:bg-[var(--surface-raised)] border border-[var(--border-default)] hover:border-[var(--border-hover-neutral)] shadow-xs transition-all cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <PenLine className="h-4 w-4 text-[var(--text-secondary)]" />
            <span>快速记录成长</span>
          </button>
        </div>
      )}
    </div>
  );
}
