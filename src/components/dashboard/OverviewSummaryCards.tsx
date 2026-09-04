"use client";

import React from "react";
import Link from "next/link";
import type { DashboardSnapshot } from "@/lib/store/types";
import { Layers3, Route, FileBox, Network, ChevronRight } from "lucide-react";
import { RPGCard } from "@/components/ui";

export interface OverviewSummaryCardsProps {
  dashboard: DashboardSnapshot;
}

export function OverviewSummaryCards({ dashboard }: OverviewSummaryCardsProps) {
  const { skills, quests, activeQuests } = dashboard;

  const totalQuests = quests?.length ?? 0;
  const activeCount = activeQuests?.length ?? 0;
  const masteredCount = skills.filter((s) => s.masteryLevel > 0).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Skills Card */}
      <Link href="/skills" className="block group focus-visible:outline-none min-h-[var(--touch-target-min)]">
        <RPGCard
          entityType="skill"
          className="p-4 h-full flex flex-col justify-between gap-3 group-hover:border-[var(--entity-skill-border)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--focus-ring-color)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-[var(--font-weight-medium)] uppercase tracking-wider text-[var(--entity-skill-text)]">
              <Layers3 className="h-4 w-4 shrink-0" />
              技能树 · Skills
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {skills.length}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              已激活技能 ({masteredCount} 项具精通度)
            </div>
          </div>
        </RPGCard>
      </Link>

      {/* Quests Card */}
      <Link href="/quests" className="block group focus-visible:outline-none min-h-[var(--touch-target-min)]">
        <RPGCard
          entityType="quest"
          className="p-4 h-full flex flex-col justify-between gap-3 group-hover:border-[var(--entity-quest-border)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--focus-ring-color)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-[var(--font-weight-medium)] uppercase tracking-wider text-[var(--entity-quest-text)]">
              <Route className="h-4 w-4 shrink-0" />
              任务体系 · Quests
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {activeCount}
              <span className="text-sm font-normal text-[var(--text-muted)] ml-1">
                / {totalQuests}
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              进行中 / 累计任务目标
            </div>
          </div>
        </RPGCard>
      </Link>

      {/* Artifacts Card */}
      <Link href="/artifacts" className="block group focus-visible:outline-none min-h-[var(--touch-target-min)]">
        <RPGCard
          entityType="artifact"
          className="p-4 h-full flex flex-col justify-between gap-3 group-hover:border-[var(--entity-artifact-border)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--focus-ring-color)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-[var(--font-weight-medium)] uppercase tracking-wider text-[var(--entity-artifact-text)]">
              <FileBox className="h-4 w-4 shrink-0" />
              造物库 · Artifacts
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
          </div>
          <div>
            <div className="text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
              造物与证据库
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              沉淀代码、规格、文章与实体证据
            </div>
          </div>
        </RPGCard>
      </Link>

      {/* Knowledge Graph Card */}
      <Link href="/knowledge" className="block group focus-visible:outline-none min-h-[var(--touch-target-min)]">
        <RPGCard
          entityType="knowledge"
          className="p-4 h-full flex flex-col justify-between gap-3 group-hover:border-[var(--entity-knowledge-border)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--focus-ring-color)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-[var(--font-weight-medium)] uppercase tracking-wider text-[var(--entity-knowledge-text)]">
              <Network className="h-4 w-4 shrink-0" />
              知识图谱 · Knowledge
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
          </div>
          <div>
            <div className="text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
              认知拓扑网络
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              概念节点与因果脉络全景
            </div>
          </div>
        </RPGCard>
      </Link>
    </div>
  );
}
