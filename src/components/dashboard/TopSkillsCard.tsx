"use client";

import React from "react";
import Link from "next/link";
import type { SkillState } from "@/lib/store/types";
import { Layers3, ChevronRight } from "lucide-react";
import { GlassPanel, MasteryBadge } from "@/components/ui";

export interface TopSkillsCardProps {
  skills?: SkillState[];
}

export function TopSkillsCard({ skills = [] }: TopSkillsCardProps) {
  const topSkills = skills.slice(0, 5);

  return (
    <GlassPanel
      variant="base"
      border="default"
      className="p-5 sm:p-6 rounded-2xl shadow-[var(--shadow-card)] flex flex-col justify-between"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-3">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-[var(--entity-skill-text)]" />
          <h3 className="font-serif font-bold text-base text-[var(--text-primary)] tracking-wide">
            核心技能 · Top Skills
          </h3>
        </div>
        <Link
          href="/skills"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors min-h-[var(--touch-target-min)] px-2 -mr-2 rounded-lg focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
        >
          <span>查看全部技能</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Skills Grid */}
      {topSkills.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 my-1">
          {topSkills.map((skill) => (
            <Link
              key={skill.id || skill.name}
              href="/skills"
              className="flex items-center justify-between gap-3 p-3 min-h-[var(--touch-target-min)] rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-hover-neutral)] transition-colors group focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
            >
              <div className="flex-1 min-w-0">
                <div className="font-serif text-sm font-bold text-[var(--text-primary)] truncate">
                  {skill.name}
                </div>
                <div className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
                  Lv.{skill.level} · {skill.xp.toLocaleString()} XP
                </div>
              </div>
              <div className="shrink-0">
                <MasteryBadge level={skill.masteryLevel} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-[var(--text-muted)]">
          暂无已激活技能，完成活动以解锁技能成长
        </div>
      )}
    </GlassPanel>
  );
}
