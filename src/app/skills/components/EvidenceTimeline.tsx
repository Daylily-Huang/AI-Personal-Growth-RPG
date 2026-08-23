import { BadgeCheck, Clock } from "lucide-react";
import type { SkillDetailEvidenceItem } from "@/lib/store/types";
import { formatTimestamp } from "./presentation";

function clampEvidenceLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(6, Math.max(0, Math.round(level)));
}

export default function EvidenceTimeline({
  items,
}: {
  items: SkillDetailEvidenceItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-zinc-500">
        暂无证据记录 — 完成相关活动并确认结算后会自动生成。
      </p>
    );
  }

  return (
    <ol className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[11px] text-amber-300"
              title={`证据等级 E${clampEvidenceLevel(item.evidenceLevel)}`}
            >
              E{clampEvidenceLevel(item.evidenceLevel)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200" title={item.activityTitle ?? undefined}>
              {item.activityTitle ?? "（关联活动不可用）"}
            </span>
            {item.verified ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-emerald-300">
                <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                已验证
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-zinc-500">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                未验证
              </span>
            )}
          </div>
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
              {item.description}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
            <span>{item.evidenceType ?? "未标注类型"}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.createdAt}>{formatTimestamp(item.createdAt)}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
