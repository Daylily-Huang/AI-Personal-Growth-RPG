"use client";

import React from "react";
import type { DashboardSnapshot, SkillState } from "@/lib/store/types";
import { GlassPanel, LevelBadge, XPProgress, MasteryBadge } from "@/components/ui";

export interface PlayerHeroProps {
  dashboard: DashboardSnapshot;
}

export function PlayerHero({ dashboard }: PlayerHeroProps) {
  const { player, levelProgress, skills } = dashboard;

  return (
    <GlassPanel
      variant="base"
      border="default"
      data-testid="dashboard-player-hero"
      className="p-5 lg:p-6 shadow-[var(--shadow-card)] relative overflow-hidden"
    >
      {/* Background Environmental Landscape Flourish (Aria-hidden, pointer-events-none) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute -right-6 -bottom-6 w-64 h-64 opacity-10 [background:radial-gradient(ellipse_at_bottom_right,var(--gold-400),transparent_70%)]"
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-[var(--z-canvas)]">
        {/* Left Column: Player Identity & XP Progression */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-[var(--font-weight-medium)] uppercase tracking-[var(--tracking-wider)] text-[var(--text-muted)]">
            <span>修习者档案 · Practitioner</span>
            <span className="rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-mono text-[var(--text-secondary)]">
              Provisional XP Level
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <LevelBadge level={player.playerLevel} size="lg" />
            <span className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              XP Lv.{player.playerLevel}
            </span>
            <span className="text-sm font-mono text-[var(--text-muted)]">
              {player.totalXp} XP total
            </span>
          </div>

          <div className="mt-4 w-full max-w-md space-y-1.5">
            <XPProgress
              current={levelProgress.xpIntoLevel}
              max={levelProgress.xpNeededForNext}
              showReadout={false}
              size="md"
            />
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
              <span>{levelProgress.xpIntoLevel} / {levelProgress.xpNeededForNext} XP to next level</span>
              <span>{Math.round(levelProgress.progress * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Right Column: Practitioner Vitals (Energy, Focus, Momentum) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
          <div
            tabIndex={0}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] min-w-[76px] sm:min-w-[88px] shadow-sm transition-colors hover:border-[var(--border-hover-neutral)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-[var(--font-weight-medium)]">Energy</span>
            <span className="mt-1 text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">{player.energy}</span>
            <span className="text-xs text-[var(--text-muted)]">精力</span>
          </div>
          <div
            tabIndex={0}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] min-w-[76px] sm:min-w-[88px] shadow-sm transition-colors hover:border-[var(--border-hover-neutral)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-[var(--font-weight-medium)]">Focus</span>
            <span className="mt-1 text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">{player.focus}</span>
            <span className="text-xs text-[var(--text-muted)]">心流</span>
          </div>
          <div
            tabIndex={0}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] min-w-[76px] sm:min-w-[88px] shadow-sm transition-colors hover:border-[var(--border-hover-neutral)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-[var(--font-weight-medium)]">Momentum</span>
            <span className="mt-1 text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">{player.momentum}</span>
            <span className="text-xs text-[var(--text-muted)]">势能</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Progressing Skills Summary */}
      {skills.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-[var(--font-weight-medium)] mr-1">
            精通技能 · Active Skills:
          </span>
          {skills.slice(0, 6).map((skill: SkillState) => (
            <a
              key={skill.id || skill.name}
              href="/skills"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover-neutral)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
            >
              <span className="font-[var(--font-weight-medium)]">{skill.name}</span>
              <span className="text-[var(--gold-500)] font-mono text-xs">XP Lv.{skill.level}</span>
              <MasteryBadge level={skill.masteryLevel} size="sm" />
            </a>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
