"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Quest, QuestSize, QuestType } from "@/lib/store/types";
import { QUEST_TYPE_META, QUEST_SIZE_META } from "./QuestCard";
import { Target, X, AlertCircle } from "lucide-react";

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

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input on mount & handle Escape key
  useEffect(() => {
    firstInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "创建任务失败");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-quest-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-xl transition-all"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <h2
            id="create-quest-title"
            className="text-lg font-[var(--font-weight-semibold)] text-[var(--text-primary)] flex items-center gap-2"
          >
            <Target className="h-5 w-5 text-[var(--entity-quest-text)]" aria-hidden="true" />
            新建任务目标
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex items-center justify-center cursor-pointer"
            aria-label="关闭弹窗"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-[var(--state-error-border)] bg-[var(--state-error-bg)] p-3 text-xs text-[var(--state-error-text)] flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="quest-title-input"
              className="block text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] mb-1"
            >
              任务名称 <span className="text-[var(--state-error-text)]">*</span>
            </label>
            <input
              id="quest-title-input"
              ref={firstInputRef}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：深入掌握 PostgreSQL RLS 与安全函数策略"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-hidden min-h-[var(--touch-target-min)]"
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
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-hidden"
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
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-hidden min-h-[var(--touch-target-min)] cursor-pointer"
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
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-hidden disabled:opacity-50 min-h-[var(--touch-target-min)] cursor-pointer"
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
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-hidden min-h-[var(--touch-target-min)] cursor-pointer"
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
                className="w-full accent-[var(--gold-base)] cursor-pointer"
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
                className="rounded border-[var(--border-default)] bg-[var(--surface-ground)] accent-[var(--gold-base)] focus:ring-0 cursor-pointer h-4 w-4"
              />
              <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                设为当前主线任务
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer min-h-[var(--touch-target-min)]">
              <input
                type="checkbox"
                checked={isBoss}
                onChange={(e) => setIsBoss(e.target.checked)}
                className="rounded border-[var(--border-default)] bg-[var(--surface-ground)] accent-[var(--state-error-text)] focus:ring-0 cursor-pointer h-4 w-4"
              />
              <span className="font-[var(--font-weight-medium)] text-[var(--state-error-text)]">
                Boss 挑战节点
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 min-h-[var(--touch-target-min)] text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--gold-base)] px-5 py-2 min-h-[var(--touch-target-min)] text-xs font-[var(--font-weight-semibold)] text-[var(--gold-contrast)] hover:bg-[var(--gold-hover)] active:bg-[var(--gold-active)] disabled:opacity-50 transition-colors cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gold-focus-ring)]"
            >
              {submitting ? "创建中..." : "确认创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
