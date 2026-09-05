"use client";

import React, { useState } from "react";
import type { Quest, QuestSize, QuestType } from "@/lib/store/types";
import { BaseModal, PrimaryButton, SecondaryButton } from "@/components/ui";
import { QUEST_TYPE_META, QUEST_SIZE_META } from "./QuestCard";
import { Target, AlertCircle } from "lucide-react";

export interface CreateQuestModalProps {
  existingQuests: Quest[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateQuestModal({
  existingQuests,
  onClose,
  onCreated,
}: CreateQuestModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questType, setQuestType] = useState<QuestType>("learning");
  const [questSize, setQuestSize] = useState<QuestSize>("standard");
  const [parentQuestId, setParentQuestId] = useState<string>("");
  const [isMainQuest, setIsMainQuest] = useState(false);
  const [isBoss, setIsBoss] = useState(false);
  const [difficulty, setDifficulty] = useState(0.5);
  const [goalAlignment, setGoalAlignment] = useState(0.8);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          questType,
          questSize: isMainQuest ? "main" : questSize,
          parentQuestId: parentQuestId || null,
          isMainQuest,
          isBoss,
          difficulty,
          goalAlignment,
          status: "active",
        }),
      });

      if (!res.ok) {
        let safeMsg = "创建任务失败，请稍后重试";
        try {
          const data = await res.json();
          if (
            typeof data?.error === "string" &&
            !data.error.toLowerCase().includes("sql") &&
            !data.error.toLowerCase().includes("database") &&
            !data.error.toLowerCase().includes("relation")
          ) {
            safeMsg = data.error;
          }
        } catch {
          // Keep safe fallback
        }
        throw new Error(safeMsg);
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "创建任务失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  const modalFooter = (
    <div className="flex justify-end gap-3 w-full">
      <SecondaryButton
        type="button"
        size="sm"
        onClick={onClose}
        disabled={submitting}
      >
        取消
      </SecondaryButton>
      <PrimaryButton
        type="submit"
        size="sm"
        form="create-quest-form"
        loading={submitting}
        disabled={submitting || !title.trim()}
      >
        确认创建
      </PrimaryButton>
    </div>
  );

  return (
    <BaseModal
      open={true}
      onClose={() => !submitting && onClose()}
      title={
        <span className="flex items-center gap-2 text-base font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
          <Target className="h-5 w-5 text-[var(--entity-quest-text)]" aria-hidden="true" />
          <span>新建任务目标</span>
        </span>
      }
      footer={modalFooter}
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] p-3 text-xs text-[var(--state-danger-text)] flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <form id="create-quest-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="quest-title-input"
            className="block text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] mb-1"
          >
            任务名称 <span className="text-[var(--state-danger-text)]">*</span>
          </label>
          <input
            id="quest-title-input"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：深入掌握 PostgreSQL RLS 与安全函数策略"
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-raised)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] min-h-[var(--touch-target-min)]"
          />
        </div>

        <div>
          <label
            htmlFor="quest-description-input"
            className="block text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] mb-1"
          >
            任务描述
          </label>
          <textarea
            id="quest-description-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="具体验收标准或关键里程碑..."
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-raised)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="quest-type-select"
              className="block text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] mb-1"
            >
              任务类型
            </label>
            <select
              id="quest-type-select"
              value={questType}
              onChange={(e) => setQuestType(e.target.value as QuestType)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--border-raised)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] min-h-[var(--touch-target-min)] cursor-pointer"
            >
              {Object.entries(QUEST_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="quest-size-select"
              className="block text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] mb-1"
            >
              任务规模
            </label>
            <select
              id="quest-size-select"
              value={questSize}
              disabled={isMainQuest}
              onChange={(e) => setQuestSize(e.target.value as QuestSize)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--border-raised)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] disabled:opacity-50 min-h-[var(--touch-target-min)] cursor-pointer"
            >
              {Object.entries(QUEST_SIZE_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="quest-parent-select"
            className="block text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] mb-1"
          >
            上级父任务 (可选树形关联)
          </label>
          <select
            id="quest-parent-select"
            value={parentQuestId}
            onChange={(e) => setParentQuestId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--border-raised)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] min-h-[var(--touch-target-min)] cursor-pointer"
          >
            <option value="">-- 无上级任务 (作为顶级任务) --</option>
            {existingQuests.map((q) => (
              <option key={q.id} value={q.id}>
                {q.isMainQuest ? "★ [主线] " : ""}{q.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
              <span>任务难度 (Difficulty)</span>
              <span className="font-mono text-[var(--text-primary)]">
                {(difficulty * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={difficulty}
              onChange={(e) => setDifficulty(parseFloat(e.target.value))}
              className="w-full accent-[var(--entity-quest-text)] cursor-pointer"
              aria-label="任务难度滑块"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
              <span>目标对齐 (Alignment)</span>
              <span className="font-mono text-[var(--text-primary)]">
                {(goalAlignment * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={goalAlignment}
              onChange={(e) => setGoalAlignment(parseFloat(e.target.value))}
              className="w-full accent-[var(--entity-quest-text)] cursor-pointer"
              aria-label="目标对齐滑块"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer min-h-[var(--touch-target-min)]">
            <input
              type="checkbox"
              checked={isMainQuest}
              onChange={(e) => setIsMainQuest(e.target.checked)}
              className="rounded border-[var(--border-default)] bg-[var(--surface-ground)] accent-[var(--entity-quest-text)] focus:ring-0 cursor-pointer h-4 w-4"
            />
            <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">
              设为当前主线目标
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer min-h-[var(--touch-target-min)]">
            <input
              type="checkbox"
              checked={isBoss}
              onChange={(e) => setIsBoss(e.target.checked)}
              className="rounded border-[var(--border-default)] bg-[var(--surface-ground)] accent-[var(--state-danger-text)] focus:ring-0 cursor-pointer h-4 w-4"
            />
            <span className="font-[var(--font-weight-medium)] text-[var(--state-danger-text)]">
              设为重点攻坚节点 (Key Milestone)
            </span>
          </label>
        </div>
      </form>
    </BaseModal>
  );
}
