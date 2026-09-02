"use client";

import React from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { GlassPanel, SecondaryButton } from "@/components/ui";

export function LoadingState() {
  return (
    <div
      data-testid="dashboard-loading-state"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-[var(--text-muted)]"
    >
      <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-400)]" />
      <p className="text-sm font-[var(--font-weight-medium)]">Loading your growth world…</p>
    </div>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <GlassPanel
      variant="base"
      border="default"
      data-testid="dashboard-error-state"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center max-w-lg mx-auto my-12"
    >
      <div className="rounded-full bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] p-3 text-[var(--state-danger-text)]">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-serif text-lg font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
          加载失败
        </h3>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{message}</p>
      </div>
      <SecondaryButton
        onClick={onRetry}
        icon={<RefreshCw className="h-4 w-4" />}
        className="mt-2 min-h-[40px]"
      >
        重试 / Retry
      </SecondaryButton>
    </GlassPanel>
  );
}

export interface EmptyStateProps {
  onRefresh: () => void;
}

export function EmptyState({ onRefresh }: EmptyStateProps) {
  return (
    <GlassPanel
      variant="base"
      border="default"
      data-testid="dashboard-empty-state"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center max-w-lg mx-auto my-12"
    >
      <div className="text-5xl select-none" aria-hidden="true">
        🌱
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
          还没有成长记录
        </h2>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-md">
          完成第一次 Growth Assessment 后，系统会根据真实行为建立技能树和成长账本。
        </p>
      </div>
      <SecondaryButton
        onClick={onRefresh}
        icon={<RefreshCw className="h-4 w-4" />}
        className="mt-2 min-h-[40px]"
      >
        Refresh
      </SecondaryButton>
    </GlassPanel>
  );
}
