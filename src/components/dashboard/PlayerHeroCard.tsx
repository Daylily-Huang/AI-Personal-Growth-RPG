"use client";

import React from "react";
import type { DashboardSnapshot } from "@/lib/store/types";
import { GlassPanel, LevelBadge, XPProgress } from "@/components/ui";

export interface PlayerHeroCardProps {
  dashboard: DashboardSnapshot;
}

export function PlayerHeroCard({ dashboard }: PlayerHeroCardProps) {
  const { player, levelProgress } = dashboard;
  const neededXp = Math.max(0, levelProgress.xpNeededForNext - levelProgress.xpIntoLevel);

  return (
    <GlassPanel
      variant="base"
      border="default"
      data-testid="dashboard-player-hero"
      className="p-5 sm:p-6 rounded-2xl shadow-[var(--shadow-card)] relative overflow-hidden flex flex-col justify-between min-h-[260px]"
    >
      {/* Background Ink-Wash Pine & Misty Mountain Atmosphere (东方松柏远山写意水墨，无奇幻武侠要素) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute right-0 bottom-0 top-0 w-[55%] max-w-[320px] overflow-hidden opacity-[0.16] text-[var(--text-primary)] mix-blend-multiply"
      >
        <svg
          viewBox="0 0 320 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-cover"
        >
          {/* Distant Mountain Silhouettes */}
          <path
            d="M80,140 Q140,110 200,128 T320,118 L320,260 L80,260 Z"
            fill="currentColor"
            opacity="0.3"
          />
          <path
            d="M130,165 Q185,140 240,152 T320,145 L320,260 L130,260 Z"
            fill="currentColor"
            opacity="0.5"
          />

          {/* Near Crag & Ancient Pine Trunk (写意古松) */}
          <path
            d="M275,260 Q285,210 290,175 Q294,150 285,130 Q278,115 264,105 Q252,98 244,102"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M285,135 Q298,125 315,128"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M272,118 Q255,110 238,114"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />

          {/* Pine Needle Clusters */}
          <g fill="currentColor" opacity="0.85">
            <ellipse cx="236" cy="112" rx="22" ry="9" transform="rotate(-15 236 112)" />
            <ellipse cx="252" cy="103" rx="18" ry="8" transform="rotate(-5 252 103)" />
            <ellipse cx="282" cy="120" rx="24" ry="10" transform="rotate(12 282 120)" />
            <ellipse cx="308" cy="128" rx="20" ry="8" transform="rotate(8 308 128)" />
            <ellipse cx="265" cy="96" rx="22" ry="9" transform="rotate(-20 265 96)" />
          </g>
        </svg>
      </div>

      {/* Main Content Area */}
      <div className="relative max-w-[240px] sm:max-w-[280px]">
        {/* Practitioner Archive Heading with subtle metadata */}
        <div className="text-xs font-[var(--font-weight-medium)] uppercase tracking-[var(--tracking-wider)] text-[var(--text-muted)] flex items-center justify-between">
          <span>修习者档案 · Practitioner</span>
          <span className="font-mono text-[var(--text-muted)] font-normal">XP Lv.{player.playerLevel}</span>
        </div>

        {/* Level & XP Total Row */}
        <div className="mt-2.5 flex items-center gap-3">
          <LevelBadge level={player.playerLevel} size="lg" />
          <div>
            <div className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              成长等级
            </div>
            <div className="text-xs font-mono text-[var(--text-muted)]">
              {player.totalXp} XP total
            </div>
          </div>
        </div>

        {/* Progression Numbers */}
        <div className="mt-5 flex items-baseline gap-1.5">
          <span className="font-mono text-base sm:text-lg font-bold text-[var(--gold-500)]">
            {levelProgress.xpIntoLevel.toLocaleString()}
          </span>
          <span className="text-xs sm:text-sm font-mono text-[var(--text-muted)]">
            / {levelProgress.xpNeededForNext.toLocaleString()} XP
          </span>
        </div>

        {/* XP Progress Meter */}
        <div className="mt-1.5 w-full">
          <XPProgress
            current={levelProgress.xpIntoLevel}
            max={levelProgress.xpNeededForNext}
            showReadout={false}
            size="sm"
            className="w-full"
          />
        </div>

        {/* Distance to Next Level */}
        <div className="mt-2 text-xs text-[var(--text-muted)] font-sans">
          距离升级还需{" "}
          <span className="font-mono font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
            {neededXp.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* Bottom Vitals Row: Energy, Focus, Momentum */}
      <div className="relative mt-5 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--surface-ground)]/50 border border-[var(--border-subtle)] min-h-[var(--touch-target-min)]">
          <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-[var(--font-weight-medium)]">Energy</span>
          <span className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)] tabular-nums">{player.energy}</span>
          <span className="text-xs text-[var(--text-muted)]">精力</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--surface-ground)]/50 border border-[var(--border-subtle)] min-h-[var(--touch-target-min)]">
          <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-[var(--font-weight-medium)]">Focus</span>
          <span className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)] tabular-nums">{player.focus}</span>
          <span className="text-xs text-[var(--text-muted)]">心流</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--surface-ground)]/50 border border-[var(--border-subtle)] min-h-[var(--touch-target-min)]">
          <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-[var(--font-weight-medium)]">Momentum</span>
          <span className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)] tabular-nums">{player.momentum}</span>
          <span className="text-xs text-[var(--text-muted)]">势能</span>
        </div>
      </div>
    </GlassPanel>
  );
}
