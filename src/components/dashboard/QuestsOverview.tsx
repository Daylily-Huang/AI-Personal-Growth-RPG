"use client";

import React from "react";
import type { Quest } from "@/lib/store/types";
import { Crown, ChevronRight, Target } from "lucide-react";
import { SectionCard, QuestProgress } from "@/components/ui";

export interface QuestsOverviewProps {
  mainQuest?: Quest | null;
  activeQuests?: Quest[];
}

export function QuestsOverview({ mainQuest, activeQuests }: QuestsOverviewProps) {
  const quests = activeQuests ?? [];
  const secondaryQuests = quests.filter((q) => !mainQuest || q.id !== mainQuest.id);

  return (
    <SectionCard
      title="任务目标概览 (Active Quests)"
      icon={<Target className="h-5 w-5 text-[var(--entity-quest-text)]" />}
      action={
        <a
          href="/quests"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] rounded"
        >
          查看全部任务大厅 <ChevronRight className="h-3.5 w-3.5" />
        </a>
      }
      className="p-5 space-y-4"
    >
      {/* Featured Main Quest */}
      {mainQuest ? (
        <div className="rounded-lg border border-[var(--border-gold-subtle)] bg-[var(--surface-raised)] p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[var(--gold-500)] font-[var(--font-weight-semibold)] mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-[var(--gold-400)] shrink-0" />
              当前主线任务 (Main Quest)
            </span>
            <span className="font-mono">{Math.round(mainQuest.progress)}%</span>
          </div>
          <div className="text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
            {mainQuest.title}
          </div>
          <div className="mt-2.5">
            <QuestProgress progress={mainQuest.progress} showLabel={false} size="md" />
          </div>
        </div>
      ) : null}

      {/* Secondary Active Quests */}
      {secondaryQuests.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {secondaryQuests.slice(0, 4).map((q) => (
            <div
              key={q.id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 flex flex-col justify-between gap-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="truncate font-[var(--font-weight-medium)] text-[var(--text-primary)]">{q.title}</span>
                <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">{Math.round(q.progress)}%</span>
              </div>
              <QuestProgress progress={q.progress} showLabel={false} size="sm" />
            </div>
          ))}
        </div>
      ) : !mainQuest ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] p-6 text-center text-xs text-[var(--text-muted)]">
          暂无进行中的任务，点击右上角进入任务大厅创建新目标。
        </div>
      ) : null}
    </SectionCard>
  );
}
