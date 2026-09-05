"use client";

import React from "react";
import type { Quest } from "@/lib/store/types";
import { GlassPanel } from "@/components/ui";
import { Target, ListChecks, CheckCircle2, Route } from "lucide-react";

export interface QuestsOverviewStatsProps {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  mainQuest?: Quest | null;
}

export function QuestsOverviewStats({
  totalCount,
  activeCount,
  completedCount,
  mainQuest,
}: QuestsOverviewStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* 1. Total Quests */}
      <GlassPanel
        variant="base"
        border="default"
        className="p-4 rounded-xl shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-[var(--font-weight-medium)]">
          <span>总任务数</span>
          <Target className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
        <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-2">
          {totalCount}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">累计规划目标</div>
      </GlassPanel>

      {/* 2. Active Quests */}
      <GlassPanel
        variant="base"
        border="default"
        className="p-4 rounded-xl shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-xs text-[var(--entity-quest-text)] font-[var(--font-weight-medium)]">
          <span>进行中 · Active</span>
          <ListChecks className="h-4 w-4 text-[var(--entity-quest-text)]" />
        </div>
        <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-2">
          {activeCount}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">当前正在攻坚</div>
      </GlassPanel>

      {/* 3. Completed Quests */}
      <GlassPanel
        variant="base"
        border="default"
        className="p-4 rounded-xl shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-xs text-[var(--state-success-text)] font-[var(--font-weight-medium)]">
          <span>已完成 · Done</span>
          <CheckCircle2 className="h-4 w-4 text-[var(--state-success-text)]" />
        </div>
        <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-2">
          {completedCount}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">达成里程碑目标</div>
      </GlassPanel>

      {/* 4. Main Quest Status */}
      <GlassPanel
        variant="base"
        border="default"
        className="p-4 rounded-xl shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-xs text-[var(--entity-quest-text)] font-[var(--font-weight-medium)]">
          <span>主线状态 · Main</span>
          <Route className="h-4 w-4 text-[var(--entity-quest-text)]" />
        </div>
        <div className="text-sm font-semibold text-[var(--text-primary)] mt-2 truncate">
          {mainQuest ? mainQuest.title : "未设定主线"}
        </div>
        <div className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
          {mainQuest ? `当前进度 ${Math.round(mainQuest.progress)}%` : "可设为主线目标"}
        </div>
      </GlassPanel>
    </div>
  );
}
