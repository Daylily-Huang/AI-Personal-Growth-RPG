import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Lock, Crown } from "lucide-react";
import type { SkillFlowNodeData } from "@/lib/store/types";
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
      aria-label={`技能 ${data.name}，状态：${visual.label}`}
      className={`w-56 rounded-lg border px-3 py-2.5 text-zinc-100 shadow-lg transition-shadow ${visual.containerClass} ${
        selected ? "ring-1 ring-white/50" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400"
        isConnectable={false}
      />

      {visual.icon === "crown" ? (
        <Crown
          aria-hidden="true"
          className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-purple-500/90 p-0.5 text-white shadow"
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold" title={data.name}>
          {data.name}
        </span>
        {data.domainLabel ? (
          <span className="max-w-[88px] shrink-0 truncate rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {data.domainLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
          Lv.{data.level}
        </span>
        <span className="rounded bg-sky-400/15 px-1.5 py-0.5 font-mono text-[11px] text-sky-300">
          M{data.masteryLevel}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${visual.badgeClass}`}
        >
          {visual.pulseDot ? (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300"
            />
          ) : null}
          {visual.icon === "lock" ? (
            <Lock aria-hidden="true" className="h-3 w-3" />
          ) : null}
          {visual.label}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>
          {data.xp} XP · 置信 {formatConfidence(data.masteryConfidence)}
        </span>
        {data.unfulfilledPrerequisiteCount > 0 ? (
          <span
            className="inline-flex items-center gap-0.5 text-rose-300/80"
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
        className="!bg-slate-400"
        isConnectable={false}
      />
    </div>
  );
}

export default memo(SkillNodeView);
