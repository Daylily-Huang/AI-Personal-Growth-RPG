"use client";

import React from "react";
import { GlassPanel } from "@/components/ui";
import { Target, AlertCircle, Plus, RefreshCw } from "lucide-react";

export interface QuestsSkeletonLoadingProps {
  className?: string;
}

export function QuestsSkeletonLoading({ className = "" }: QuestsSkeletonLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="加载任务中"
      className={`space-y-6 ${className}`}
    >
      {/* Overview stats skeleton: 4 cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <GlassPanel
            key={i}
            variant="base"
            border="default"
            className="p-4 rounded-xl min-h-[96px] flex flex-col justify-between animate-pulse motion-reduce:animate-none"
          >
            <div className="h-3 w-16 rounded bg-[var(--surface-raised)]" />
            <div className="h-7 w-12 rounded bg-[var(--surface-raised)] mt-2" />
            <div className="h-3 w-20 rounded bg-[var(--surface-ground)] mt-1" />
          </GlassPanel>
        ))}
      </div>

      {/* Tabs bar skeleton */}
      <div className="flex gap-4 border-b border-[var(--border-subtle)] pb-2">
        <div className="h-8 w-24 rounded bg-[var(--surface-raised)] animate-pulse motion-reduce:animate-none" />
        <div className="h-8 w-24 rounded bg-[var(--surface-raised)] animate-pulse motion-reduce:animate-none" />
        <div className="h-8 w-24 rounded bg-[var(--surface-raised)] animate-pulse motion-reduce:animate-none" />
        <div className="h-8 w-24 rounded bg-[var(--surface-raised)] animate-pulse motion-reduce:animate-none" />
      </div>

      {/* Quest cards skeletons */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 min-h-[140px] flex flex-col justify-between animate-pulse motion-reduce:animate-none"
          >
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="h-5 w-14 rounded bg-[var(--surface-raised)]" />
                <div className="h-5 w-20 rounded bg-[var(--surface-raised)]" />
              </div>
              <div className="h-5 w-48 rounded bg-[var(--surface-raised)]" />
              <div className="h-4 w-72 rounded bg-[var(--surface-ground)]" />
            </div>
            <div className="pt-3 border-t border-[var(--border-subtle)] flex justify-between items-center">
              <div className="h-3 w-32 rounded bg-[var(--surface-raised)]" />
              <div className="h-3 w-24 rounded bg-[var(--surface-ground)]" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">加载任务数据中...</span>
    </div>
  );
}

export interface QuestsEmptyStateProps {
  onCreateQuest?: () => void;
  className?: string;
}

export function QuestsEmptyState({ onCreateQuest, className = "" }: QuestsEmptyStateProps) {
  return (
    <div
      role="region"
      aria-label="暂无任务"
      className={`rounded-xl border border-dashed border-[var(--border-default)] p-12 text-center bg-[var(--surface-ground)] ${className}`}
    >
      <Target className="mx-auto h-10 w-10 text-[var(--text-muted)] mb-3" aria-hidden="true" />
      <h3 className="text-base font-[var(--font-weight-medium)] text-[var(--text-primary)]">
        暂无任务
      </h3>
      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
        创建你的第一个主线或阶段性学习任务，建立清晰的成长路径。
      </p>
      {onCreateQuest && (
        <button
          type="button"
          onClick={onCreateQuest}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gold-base)] px-4 py-2.5 min-h-[var(--touch-target-min)] text-xs font-[var(--font-weight-semibold)] text-[var(--gold-contrast)] hover:bg-[var(--gold-hover)] active:bg-[var(--gold-active)] transition-colors cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gold-focus-ring)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>创建任务目标</span>
        </button>
      )}
    </div>
  );
}

export interface QuestsErrorStateProps {
  error: string;
  onRetry?: () => void;
  className?: string;
}

export function QuestsErrorState({ error, onRetry, className = "" }: QuestsErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-[var(--state-error-border)] bg-[var(--state-error-bg)] p-4 text-sm text-[var(--state-error-text)] flex items-start justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h4 className="font-[var(--font-weight-medium)]">加载任务失败</h4>
          <p className="text-xs opacity-90 mt-0.5">{error}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 min-h-[var(--touch-target-min)] text-xs font-[var(--font-weight-medium)] bg-[var(--surface-ground)] hover:bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>重试</span>
        </button>
      )}
    </div>
  );
}
