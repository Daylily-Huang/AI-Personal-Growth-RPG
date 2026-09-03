"use client";

import React from "react";
import { Plus, Zap } from "lucide-react";
import { SectionCard, PrimaryButton } from "@/components/ui";

export interface QuickLogCardProps {
  rawInput: string;
  setRawInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export function QuickLogCard({
  rawInput,
  setRawInput,
  onSubmit,
  submitting,
}: QuickLogCardProps) {
  return (
    <SectionCard
      title="Quick Log — 记录你刚才在现实中做了什么"
      icon={<Plus className="h-5 w-5 text-[var(--text-secondary)] shrink-0" />}
      className="p-5 sm:p-6 rounded-2xl shadow-[var(--shadow-card)]"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row mt-1">
        <label htmlFor="quick-log-input" className="sr-only">
          输入现实修习内容
        </label>
        <input
          id="quick-log-input"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="例如：今天读了 1.5 小时 LC 方法，理解了 LR 与 LC 的区别，但还没有实际跑数据"
          className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 min-h-[var(--touch-target-min)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--focus-ring-color)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] shadow-xs"
        />
        <PrimaryButton
          type="submit"
          disabled={!rawInput.trim()}
          loading={submitting}
          icon={<Zap className="h-4 w-4" />}
          className="shrink-0 min-h-[var(--touch-target-min)]"
        >
          {submitting ? "AI 评估中…" : "记录并评估"}
        </PrimaryButton>
      </form>
      <p className="mt-2.5 text-xs text-[var(--text-muted)]">
        AI 只会生成 Proposal；你确认后，服务器 Growth Engine 才会计算并写入 XP Ledger。
      </p>
    </SectionCard>
  );
}
