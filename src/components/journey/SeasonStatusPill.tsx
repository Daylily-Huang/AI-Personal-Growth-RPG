import type { SeasonStatus } from "@/lib/outer-loop/types";

const LABELS: Record<SeasonStatus, string> = {
  DRAFT: "草稿",
  PLANNED: "已计划",
  ACTIVE: "进行中",
  COMPLETED: "已完成",
  ENDED_EARLY: "提前结束",
  ABANDONED: "已放弃",
  CANCELLED: "已取消",
};

const STATE_CLASSES: Record<SeasonStatus, string> = {
  DRAFT: "bg-[var(--status-draft-bg)] border-[var(--status-draft-border)] text-[var(--status-draft-text)]",
  PLANNED: "bg-[var(--authority-inferred-bg)] border-[var(--authority-inferred-border)] text-[var(--authority-inferred-text)]",
  ACTIVE: "bg-[var(--status-active-bg)] border-[var(--status-active-border)] text-[var(--status-active-text)]",
  COMPLETED: "bg-[var(--authority-verified-bg)] border-[var(--authority-verified-border)] text-[var(--authority-verified-text)]",
  ENDED_EARLY: "bg-[var(--status-superseded-bg)] border-[var(--status-superseded-border)] text-[var(--status-superseded-text)]",
  ABANDONED: "bg-[var(--status-archived-bg)] border-[var(--status-archived-border)] text-[var(--status-archived-text)]",
  CANCELLED: "bg-[var(--status-archived-bg)] border-[var(--status-archived-border)] text-[var(--status-archived-text)]",
};

export function SeasonStatusPill({ status }: { status: SeasonStatus }) {
  return (
    <span
      data-testid="season-status-pill"
      data-status={status}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-[var(--font-weight-semibold)] ${STATE_CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
