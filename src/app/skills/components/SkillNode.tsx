import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Lock } from "lucide-react";
import type { SkillFlowNodeData } from "@/lib/store/types";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { MasteryBadge } from "@/components/ui/MasteryBadge";
import { formatConfidence, getSkillStateVisual } from "./presentation";

/**
 * Explicit index signature is required by @xyflow/react v12
 * (`Node` constrains data to `Record<string, unknown>`).
 */
export type SkillNodeViewData = SkillFlowNodeData & {
  /** presentation-only enrichment resolved by the page from the domain list */
  domainLabel?: string | null;
  [key: string]: unknown;
};

export type SkillFlowNodeType = Node<SkillNodeViewData, "skillNode">;

function SkillNodeView({ data, selected }: NodeProps<SkillFlowNodeType>) {
  const visual = getSkillStateVisual(data.derivedState);

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`技能 ${data.name}，状态：${visual.label}`}
      onClick={() => {
        if (typeof (data as Record<string, unknown>).onSelect === "function") {
          ((data as Record<string, unknown>).onSelect as () => void)();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
      className={`relative w-56 rounded-[var(--radius-lg)] border px-3 py-2.5 text-[var(--text-primary)] transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] ${visual.containerClass} ${
        selected
          ? "ring-2 ring-[var(--focus-ring-color)] border-transparent shadow-[var(--shadow-raised)]"
          : "hover:border-[var(--border-hover-neutral)]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[var(--border-raised)] !w-2 !h-2 !border-none"
        isConnectable={false}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-[var(--text-primary)]" title={data.name}>
          {data.name}
        </span>
        {data.domainLabel ? (
          <span className="max-w-[88px] shrink-0 truncate rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
            {data.domainLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <LevelBadge level={data.level} size="sm" />
        <MasteryBadge level={data.masteryLevel} size="sm" />
        <span
          className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] ${visual.badgeClass}`}
        >
          {visual.pulseDot ? (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-pulse motion-reduce:animate-none rounded-full bg-[var(--state-success-text)]"
            />
          ) : null}
          {visual.icon === "lock" ? (
            <Lock aria-hidden="true" className="h-3 w-3" />
          ) : null}
          {visual.label}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>
          {data.xp} XP · 置信 {formatConfidence(data.masteryConfidence)}
        </span>
        {data.unfulfilledPrerequisiteCount > 0 ? (
          <span
            className="inline-flex items-center gap-0.5 text-[var(--state-danger-text)]"
            title="存在未满足的前置技能（需要前置掌握度 ≥ M2 且置信 ≥ 50%）"
          >
            <Lock aria-hidden="true" className="h-3 w-3" />×
            {data.unfulfilledPrerequisiteCount}
          </span>
        ) : null}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[var(--border-raised)] !w-2 !h-2 !border-none"
        isConnectable={false}
      />
    </div>
  );
}

export default memo(SkillNodeView);
