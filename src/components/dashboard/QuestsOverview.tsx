"use client";

import React from "react";
import Link from "next/link";
import type { Quest } from "@/lib/store/types";
import { Crown, ChevronRight, Target } from "lucide-react";
import { GlassPanel, QuestProgress } from "@/components/ui";

export interface QuestsOverviewProps {
  mainQuest?: Quest | null;
  activeQuests?: Quest[];
}

export function QuestsOverview({ mainQuest, activeQuests = [] }: QuestsOverviewProps) {
  // Only display main quest as current action if its status is strictly "active"
  const activeMainQuest = mainQuest?.status === "active" ? mainQuest : null;

  // Secondary active quests: strictly status === "active" and not the active main quest
  const secondaryQuests = activeQuests.filter(
    (q) => q.status === "active" && (!activeMainQuest || q.id !== activeMainQuest.id)
  );

  const hasAnyActive = Boolean(activeMainQuest || secondaryQuests.length > 0);

  return (
    <GlassPanel
      variant="base"
      border="default"
      className="p-5 sm:p-6 rounded-2xl shadow-[var(--shadow-card)] flex flex-col justify-between min-h-[260px]"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[var(--entity-quest-text)]" />
          <h3 className="font-serif font-bold text-base text-[var(--text-primary)] tracking-wide">
            任务目标概览 (Active Quests)
          </h3>
        </div>
        <Link
          href="/quests"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors min-h-[var(--touch-target-min)] px-2 -mr-2 rounded-lg focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
        >
          <span>查看全部</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Main Quest Highlight (Active Only) */}
      {activeMainQuest ? (
        <div className="my-3 p-3.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-[var(--font-weight-medium)] text-[var(--entity-quest-text)]">
              <Crown className="h-3.5 w-3.5" />
              <span>当前主线任务 (Main Quest)</span>
            </div>
            <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
              {Math.round(activeMainQuest.progress)}%
            </span>
          </div>
          <div className="font-serif text-sm font-bold text-[var(--text-primary)] truncate">
            {activeMainQuest.title}
          </div>
          <div className="mt-2">
            <QuestProgress progress={activeMainQuest.progress} size="sm" />
          </div>
        </div>
      ) : null}

      {/* Secondary Active Quests List */}
      {secondaryQuests.length > 0 ? (
        <ul className="space-y-2 my-2">
          {secondaryQuests.slice(0, 3).map((quest) => (
            <li
              key={quest.id}
              className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[var(--surface-hover-neutral)] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--entity-quest-text)] shrink-0" />
                <span className="text-xs text-[var(--text-secondary)] truncate font-[var(--font-weight-medium)]">
                  {quest.title}
                </span>
              </div>
              <div className="w-20 shrink-0">
                <QuestProgress progress={quest.progress} size="sm" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Empty State when no active quests */}
      {!hasAnyActive && (
        <div className="my-auto py-6 text-center text-xs text-[var(--text-muted)]">
          当前无进行中的任务，可前往任务体系激活新目标
        </div>
      )}
    </GlassPanel>
  );
}
