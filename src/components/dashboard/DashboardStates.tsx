"use client";

import React from "react";
import type { DashboardSnapshot } from "@/lib/store/types";
import { AlertCircle, RefreshCw, Sparkles, PenLine } from "lucide-react";
import { GlassPanel, SecondaryButton } from "@/components/ui";

/**
 * Predicate to determine if a user has a genuinely fresh / zero-data profile.
 * A dashboard is NOT fresh if the user has any skills, quests, recent growth,
 * pending verifications, activities, or pending assessments.
 */
export function isFreshDashboard(dashboard: DashboardSnapshot | null): boolean {
  if (!dashboard) return true;
  return (
    dashboard.activities.length === 0 &&
    dashboard.pendingAssessments.length === 0 &&
    dashboard.recentGrowth.length === 0 &&
    dashboard.skills.length === 0 &&
    (dashboard.quests?.length ?? 0) === 0 &&
    (dashboard.pendingMasteryVerifications?.length ?? 0) === 0
  );
}

/**
 * LoadingState
 * Geometry-reserving skeleton that preserves layout structure to prevent layout jumps.
 * Uses role="status" and aria-busy="true", without decorative gold spinners or fake metrics.
 */
export function LoadingState() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="正在加载仪表盘数据…"
      className="flex w-full flex-col gap-6 max-w-7xl mx-auto py-2"
    >
      <span className="sr-only">正在加载修习者仪表盘数据…</span>

      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1 animate-pulse" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-[var(--surface-raised)]" />
          <div className="h-4 w-72 rounded bg-[var(--surface-raised)] opacity-70" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-[var(--surface-raised)]" />
      </div>

      {/* Top Bento Row Skeleton (Hero + Quests + Action) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-pulse" aria-hidden="true">
        {/* Hero Skeleton (col-span-5) */}
        <div className="lg:col-span-5 h-64 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] p-6 space-y-4">
          <div className="h-4 w-32 rounded bg-[var(--surface-raised)]" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--surface-raised)]" />
            <div className="space-y-1.5">
              <div className="h-6 w-24 rounded bg-[var(--surface-raised)]" />
              <div className="h-3 w-20 rounded bg-[var(--surface-raised)]" />
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--surface-raised)] mt-6" />
          <div className="pt-4 grid grid-cols-3 gap-2">
            <div className="h-12 rounded-lg bg-[var(--surface-raised)]" />
            <div className="h-12 rounded-lg bg-[var(--surface-raised)]" />
            <div className="h-12 rounded-lg bg-[var(--surface-raised)]" />
          </div>
        </div>

        {/* Quests Skeleton (col-span-7) */}
        <div className="lg:col-span-7 h-64 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] p-6 space-y-4">
          <div className="h-5 w-40 rounded bg-[var(--surface-raised)]" />
          <div className="h-20 rounded-xl bg-[var(--surface-raised)]" />
          <div className="space-y-2">
            <div className="h-8 rounded-lg bg-[var(--surface-raised)]" />
            <div className="h-8 rounded-lg bg-[var(--surface-raised)]" />
          </div>
        </div>
      </div>

      {/* Secondary Row Skeleton (QuickLog + Skills) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse" aria-hidden="true">
        <div className="lg:col-span-7 h-44 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] p-6 space-y-3">
          <div className="h-4 w-36 rounded bg-[var(--surface-raised)]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <div className="h-16 rounded-xl bg-[var(--surface-raised)]" />
            <div className="h-16 rounded-xl bg-[var(--surface-raised)]" />
            <div className="h-16 rounded-xl bg-[var(--surface-raised)]" />
            <div className="h-16 rounded-xl bg-[var(--surface-raised)]" />
          </div>
        </div>
        <div className="lg:col-span-5 h-44 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] p-6 space-y-3">
          <div className="h-4 w-44 rounded bg-[var(--surface-raised)]" />
          <div className="h-11 rounded-xl bg-[var(--surface-raised)]" />
          <div className="h-3 w-56 rounded bg-[var(--surface-raised)]" />
        </div>
      </div>
    </div>
  );
}

/**
 * ErrorState
 * Actionable error message with a retry callback without leaking raw internal errors.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-center p-8 min-h-[40vh]">
      <GlassPanel
        variant="base"
        border="default"
        className="max-w-md p-6 text-center space-y-4 rounded-2xl shadow-[var(--shadow-card)]"
      >
        <div className="w-12 h-12 rounded-full bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] flex items-center justify-center mx-auto text-[var(--state-danger-text)]">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-serif font-bold text-[var(--text-primary)]">
            仪表盘加载受阻
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {message || "获取修习数据时发生意外，请检查网络后重试。"}
          </p>
        </div>
        <SecondaryButton
          onClick={onRetry}
          icon={<RefreshCw className="w-4 h-4" />}
          className="mx-auto min-h-[var(--touch-target-min)]"
        >
          重新连接 / Retry
        </SecondaryButton>
      </GlassPanel>
    </div>
  );
}

/**
 * EmptyState / Fresh Onboarding
 * Compact onboarding card focusing directly on Quick Log for fresh practitioners.
 */
export function EmptyState({
  onFocusQuickLog,
}: {
  onFocusQuickLog?: () => void;
}) {
  return (
    <GlassPanel
      variant="base"
      border="default"
      className="p-6 rounded-2xl shadow-[var(--shadow-card)] text-center max-w-xl mx-auto my-4 space-y-3"
    >
      <div className="w-10 h-10 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto text-[var(--text-secondary)]">
        <Sparkles className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-serif text-base font-bold text-[var(--text-primary)]">
          开启你的现实修习旅程
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto leading-relaxed">
          记录你在现实中完成的学习、工作或练习，AI 将评估你的成长并结算真实 XP 与技能精通度。
        </p>
      </div>
      {onFocusQuickLog && (
        <button
          type="button"
          onClick={onFocusQuickLog}
          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] bg-[var(--surface-raised)] border border-[var(--border-default)] hover:border-[var(--border-hover-neutral)] transition-all cursor-pointer shadow-xs focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
        >
          <PenLine className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span>立即开始第一次记录</span>
        </button>
      )}
    </GlassPanel>
  );
}
