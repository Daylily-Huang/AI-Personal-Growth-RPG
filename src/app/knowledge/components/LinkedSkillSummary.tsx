"use client";

import { useEffect, useState } from "react";
import type { SkillDetailResponse } from "@/lib/store/types";
import { MasteryBadge } from "@/components/ui/MasteryBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { XPProgress } from "@/components/ui/XPProgress";
import { RPGCard } from "@/components/ui/RPGCard";

/** Skill read model only. Knowledge authority is never converted to mastery. */
export default function LinkedSkillSummary({ skillId }: { skillId: string }) {
  const [result, setResult] = useState<{ id: string; skill?: SkillDetailResponse["skill"]; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/skills/${encodeURIComponent(skillId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("关联技能状态暂不可用");
        const detail: SkillDetailResponse = await response.json();
        if (!detail.skill || detail.skill.id !== skillId) throw new Error("关联技能状态暂不可用");
        if (!controller.signal.aborted) setResult({ id: skillId, skill: detail.skill });
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ id: skillId, error: "关联技能状态暂不可用" }); });
    return () => controller.abort();
  }, [skillId]);
  const current = result?.id === skillId ? result : null;
  return (
    <RPGCard entityType="skill" className="p-3 space-y-3" aria-label="关联技能成长状态">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">关联技能的掌握度与经验</h3>
      {!current ? <p role="status">正在读取关联技能…</p> : current.error ? <p role="status">{current.error}</p> : current.skill && <>
        <a href="/skills" className="text-[var(--text-primary)] underline">{current.skill.name}</a>
        <div className="flex flex-wrap gap-2">
          <MasteryBadge level={current.skill.masteryLevel} />
          <ConfidenceBadge variant="mastery" score={current.skill.masteryConfidence} />
        </div>
        <p className="text-[var(--text-secondary)]">累计技能经验 / 下一等级累计门槛</p>
        <XPProgress current={current.skill.xp} max={current.skill.nextLevelXp} aria-label="关联技能累计经验" />
        <p className="text-[var(--text-secondary)]">以上为关联技能状态；知识节点的权威状态与置信度单独展示。</p>
      </>}
    </RPGCard>
  );
}
