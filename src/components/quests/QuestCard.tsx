"use client";

import React from "react";
import type { Quest, QuestSize, QuestStatus, QuestType } from "@/lib/store/types";
import { RPGCard, QuestProgress } from "@/components/ui";
import {
  Play,
  Pause,
  CheckCircle2,
  Trash2,
  Calendar,
  Layers3,
  Route,
  Target,
  Lock,
  XCircle,
  Archive,
} from "lucide-react";

export const QUEST_TYPE_META: Record<
  QuestType,
  { label: string; icon: string; tokenClass: string }
> = {
  learning: {
    label: "学习吸收",
    icon: "📖",
    tokenClass: "text-[var(--state-info-text)] bg-[var(--state-info-bg)] border-[var(--state-info-border)]",
  },
  skill: {
    label: "刻意练习",
    icon: "⚡",
    tokenClass: "text-[var(--entity-skill-text)] bg-[var(--entity-skill-bg)] border-[var(--entity-skill-border)]",
  },
  production: {
    label: "真实产出",
    icon: "🛠️",
    tokenClass: "text-[var(--entity-artifact-text)] bg-[var(--entity-artifact-bg)] border-[var(--entity-artifact-border)]",
  },
  physical: {
    label: "体能恢复",
    icon: "🏃",
    tokenClass: "text-[var(--state-warning-text)] bg-[var(--state-warning-bg)] border-[var(--state-warning-border)]",
  },
  maintenance: {
    label: "日常维护",
    icon: "🧹",
    tokenClass: "text-[var(--text-secondary)] bg-[var(--surface-raised)] border-[var(--border-subtle)]",
  },
  reflection: {
    label: "复盘沉淀",
    icon: "🪞",
    tokenClass: "text-[var(--entity-knowledge-text)] bg-[var(--entity-knowledge-bg)] border-[var(--entity-knowledge-border)]",
  },
};

export const QUEST_SIZE_META: Record<
  QuestSize,
  { label: string; tokenClass: string }
> = {
  main: {
    label: "主线 Main",
    tokenClass: "bg-[var(--surface-raised)] text-[var(--entity-quest-text)] border-[var(--entity-quest-border)]",
  },
  epic: {
    label: "史诗 Epic",
    tokenClass: "bg-[var(--surface-raised)] text-[var(--text-primary)] border-[var(--border-default)]",
  },
  major: {
    label: "重要 Major",
    tokenClass: "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  },
  standard: {
    label: "标准 Standard",
    tokenClass: "bg-[var(--surface-ground)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  },
  minor: {
    label: "次要 Minor",
    tokenClass: "bg-[var(--surface-ground)] text-[var(--text-muted)] border-[var(--border-subtle)]",
  },
  micro: {
    label: "微任务 Micro",
    tokenClass: "bg-[var(--surface-ground)] text-[var(--text-muted)] border-[var(--border-subtle)]",
  },
};

export interface QuestCardProps {
  quest: Quest;
  hasChildren?: boolean;
  childrenCount?: number;
  onUpdateStatus: (id: string, s: QuestStatus) => void;
  onUpdateProgress: (id: string, p: number) => void;
  onDelete: (id: string) => void;
}

export function QuestCard({
  quest,
  hasChildren,
  childrenCount = 0,
  onUpdateStatus,
  onUpdateProgress,
  onDelete,
}: QuestCardProps) {
  const typeMeta = QUEST_TYPE_META[quest.questType] ?? QUEST_TYPE_META.learning;
  const sizeMeta = QUEST_SIZE_META[quest.questSize] ?? QUEST_SIZE_META.standard;

  return (
    <RPGCard
      entityType="quest"
      data-testid={`quest-card-${quest.id}`}
      className={`p-4 sm:p-5 rounded-2xl shadow-xs transition-all flex flex-col justify-between gap-4 ${
        quest.isMainQuest
          ? "border-[var(--entity-quest-border)] bg-[var(--surface-raised)]/90"
          : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
      }`}
    >
      {/* Top Row: Meta Tags & Title */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-[200px]">
          {/* Badge Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {quest.isMainQuest ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-[var(--font-weight-medium)] bg-[var(--surface-ground)] border border-[var(--entity-quest-border)] text-[var(--entity-quest-text)]">
                <Route className="h-3 w-3 text-[var(--entity-quest-text)]" />
                <span>主线目标</span>
              </span>
            ) : null}

            {quest.isBoss ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-[var(--font-weight-medium)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)]">
                <Target className="h-3 w-3 text-[var(--state-danger-text)]" />
                <span>重点攻坚</span>
              </span>
            ) : null}

            <span className={`px-2 py-0.5 rounded-md border text-xs font-[var(--font-weight-medium)] ${sizeMeta.tokenClass}`}>
              {sizeMeta.label}
            </span>

            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-[var(--font-weight-medium)] ${typeMeta.tokenClass}`}>
              <span>{typeMeta.icon}</span>
              <span>{typeMeta.label}</span>
            </span>

            {hasChildren ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-ground)] text-xs text-[var(--text-muted)]">
                <Layers3 className="h-3 w-3 text-[var(--text-secondary)]" />
                <span>{childrenCount} 个子任务</span>
              </span>
            ) : null}
          </div>

          {/* Quest Title & Description */}
          <div>
            <h3 className="text-base font-serif font-bold text-[var(--text-primary)] tracking-wide">
              {quest.title}
            </h3>
            {quest.description ? (
              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
                {quest.description}
              </p>
            ) : null}
          </div>
        </div>

        {/* Action Controls by Full 7-State QuestStatus Matrix */}
        <div className="flex items-center gap-2 shrink-0">
          {quest.status === "locked" ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--text-disabled)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] select-none"
              data-testid="quest-status-locked"
            >
              <Lock className="h-3.5 w-3.5 text-[var(--text-disabled)]" aria-hidden="true" />
              <span>锁定</span>
            </span>
          ) : quest.status === "available" ? (
            <button
              type="button"
              onClick={() => onUpdateStatus(quest.id, "active")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] bg-[var(--surface-raised)] border border-[var(--border-default)] hover:border-[var(--border-hover-neutral)] transition-all cursor-pointer shadow-xs focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
              data-testid="quest-action-start"
            >
              <Play className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
              <span>开始任务</span>
            </button>
          ) : quest.status === "active" ? (
            <>
              <button
                type="button"
                onClick={() => onUpdateStatus(quest.id, "paused")}
                className="inline-flex items-center justify-center p-2 min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] hover:border-[var(--border-hover-neutral)] transition-all cursor-pointer shadow-xs focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                title="暂停任务"
                aria-label="暂停任务"
                data-testid="quest-action-pause"
              >
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(quest.id, "completed")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--state-success-text)] bg-[var(--state-success-bg)] border border-[var(--state-success-border)] hover:bg-[var(--surface-hover-neutral)] transition-all cursor-pointer shadow-xs focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                data-testid="quest-action-complete"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--state-success-text)]" aria-hidden="true" />
                <span>完成</span>
              </button>
            </>
          ) : quest.status === "paused" ? (
            <button
              type="button"
              onClick={() => onUpdateStatus(quest.id, "active")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] bg-[var(--surface-raised)] border border-[var(--border-default)] hover:border-[var(--border-hover-neutral)] transition-all cursor-pointer shadow-xs focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
              data-testid="quest-action-resume"
            >
              <Play className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
              <span>继续任务</span>
            </button>
          ) : quest.status === "completed" ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--state-success-text)] bg-[var(--state-success-bg)] border border-[var(--state-success-border)] select-none"
              data-testid="quest-status-completed"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--state-success-text)]" aria-hidden="true" />
              <span>已完成</span>
            </span>
          ) : quest.status === "failed" ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--state-danger-text)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] select-none"
              data-testid="quest-status-failed"
            >
              <XCircle className="h-3.5 w-3.5 text-[var(--state-danger-text)]" aria-hidden="true" />
              <span>已失败</span>
            </span>
          ) : (
            /* archived */
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[var(--touch-target-min)] rounded-xl text-xs font-[var(--font-weight-medium)] text-[var(--text-muted)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] select-none"
              data-testid="quest-status-archived"
            >
              <Archive className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
              <span>已归档</span>
            </span>
          )}

          {/* Delete Action */}
          <button
            type="button"
            onClick={() => onDelete(quest.id)}
            className="inline-flex items-center justify-center p-2 min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded-xl text-[var(--text-muted)] hover:text-[var(--state-danger-text)] transition-colors cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
            title="删除任务"
            aria-label={`删除任务 ${quest.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Progress Meter & Parameters */}
      <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        {/* Progress Bar & Quick Bump (Restricted strictly to ACTIVE status) */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <span className="font-mono text-xs text-[var(--text-secondary)] shrink-0">
            {Math.round(quest.progress)}%
          </span>
          <div className="flex-1">
            <QuestProgress progress={quest.progress} size="sm" />
          </div>
          {quest.status === "active" && (
            <button
              type="button"
              onClick={() => onUpdateProgress(quest.id, Math.min(100, quest.progress + 25))}
              className="px-2 py-1 min-h-[var(--touch-target-min)] rounded-lg bg-[var(--surface-ground)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] transition-colors cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
              title="快速推进 +25%"
              data-testid="quest-progress-bump"
            >
              +25%
            </button>
          )}
        </div>

        {/* Parameters: Difficulty, Alignment, Deadline */}
        <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)] shrink-0">
          <span>难度 {(quest.difficulty * 100).toFixed(0)}%</span>
          <span>对齐 {(quest.goalAlignment * 100).toFixed(0)}%</span>
          {quest.deadline ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[var(--text-secondary)]" />
              <span>{new Date(quest.deadline).toLocaleDateString()}</span>
            </span>
          ) : null}
        </div>
      </div>
    </RPGCard>
  );
}
