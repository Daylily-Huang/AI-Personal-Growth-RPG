"use client";

import type { ReviewSummary } from "@/lib/review-insights/types";

export default function MonthlyGrowthReport({ summary }: { summary: ReviewSummary }) {
  const comparison = summary.comparison;
  if (!comparison) return null;
  const previous = comparison.previous, complete = summary.complete && previous.complete;
  const metrics = [
    ["账本净XP", previous.xp.net, summary.xp.net],
    ["已确认活动", previous.counts.confirmedActivities, summary.counts.confirmedActivities],
    ["Mastery事件（含更正与置信度变化）", previous.counts.masteryEvents, summary.counts.masteryEvents],
    ["新技能档案", previous.counts.newSkills, summary.counts.newSkills],
    ["新知识节点", previous.counts.newKnowledgeNodes, summary.counts.newKnowledgeNodes],
    ["新作品记录", previous.counts.newArtifacts, summary.counts.newArtifacts],
  ] as const;
  const date = (value: string) => new Date(value).toLocaleDateString("zh-CN", { timeZone: summary.period.timezone });
  return <section aria-label="月度成长对照" className="min-w-0 space-y-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4">
    <div><h4 className="font-serif text-lg">这个月，具体改变了什么？</h4>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">上月 {date(previous.period.start)} 至 {date(previous.period.end)}（不含结束日）。{comparison.partialCurrent ? "本期尚未覆盖完整自然月，数据只统计到所选时刻；与完整上月时长不同。" : "两个自然月的天数可能不同。"}差值是记录变化，不是能力增长率。</p></div>
    {!complete ? <p role="status" className="text-sm text-[var(--state-warning-text)]">两期至少一期来源不完整，无法确认总量差值，AI月报已禁用。</p> : null}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">上月与本月客观记录对照</caption>
      <thead><tr>{["指标", "完整上月", comparison.partialCurrent ? "本月至今" : "本月", "记录差值"].map(label => <th key={label} scope="col" className="p-2 font-medium">{label}</th>)}</tr></thead>
      <tbody>{metrics.map(([label, before, after]) => <tr key={label} className="border-t border-[var(--border-subtle)]"><th scope="row" className="p-2 font-normal">{label}</th><td className="p-2 tabular-nums">{before}{!previous.complete ? "（部分）" : ""}</td><td className="p-2 tabular-nums">{after}{!summary.complete ? "（部分）" : ""}</td><td className="p-2 tabular-nums">{complete ? `${after - before > 0 ? "+" : ""}${after - before}` : "未知"}</td></tr>)}</tbody>
    </table></div>
    <p className="text-sm">XP更多、创建节点或作品更多，均不能单独证明能力变强。当前主线进度没有月初快照，月度进度变化未知；两期查询也不是同一事务快照。</p>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">{[["上月", previous], ["本月", summary]].map(([label, value]) => {
      const period = value as ReviewSummary;
      return <div key={String(label)} className="min-w-0 space-y-2 break-words text-sm"><h5 className="font-semibold">{String(label)}可追溯变化（每类最多20条）</h5>
        <ul className="space-y-2">{period.masteryChanges.map(event => <li key={event.id}>Mastery {event.from} → {event.to} · {event.kind}<br /><span className="break-all text-xs text-[var(--text-muted)]">事件 {event.id} · 证据 {event.evidenceId ?? "未关联"}</span></li>)}</ul>
        {!period.masteryChanges.length ? <p>没有已读取的Mastery变化事件；不能据此推断能力提升或下降。</p> : null}
        <p>作品：{period.artifacts.map(a => `${a.title}（${a.status}）`).join("；") || "无本期新建记录"}。创建不等于验收。</p>
        <p>知识：{period.knowledge.map(k => `${k.title}（${k.status}）`).join("；") || "无本期新建记录"}。新节点不等于已掌握。</p>
        <p className="text-xs text-[var(--text-muted)]">上限外的样本与未记录变化无法证明；月报只依据实际账本和事件。</p>
      </div>;
    })}</div>
  </section>;
}
