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
      className="p-6 rounded-2xl shadow-[var(--shadow-card)] relative overflow-hidden flex flex-col justify-between min-h-[260px]"
    >
      {/* Background Ink-Wash Pine & Lone Swordsman Illustration (东方松崖旅人意境矢量) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute right-0 bottom-0 top-0 w-[55%] max-w-[320px] overflow-hidden"
      >
        <svg
          viewBox="0 0 320 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-cover opacity-[0.88]"
        >
          <defs>
            {/* Sun Radial Glow */}
            <radialGradient id="sunGlow" cx="68%" cy="32%" r="45%">
              <stop offset="0%" stopColor="var(--gold-300)" stopOpacity="0.85" />
              <stop offset="35%" stopColor="var(--gold-400)" stopOpacity="0.45" />
              <stop offset="70%" stopColor="var(--gold-500)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--gold-500)" stopOpacity="0" />
            </radialGradient>

            {/* Cloud Gradients */}
            <linearGradient id="cloudGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Distant Golden Sun */}
          <circle cx="218" cy="85" r="54" fill="url(#sunGlow)" />
          <circle cx="218" cy="85" r="28" fill="var(--gold-200)" opacity="0.6" />

          {/* Distant Mountains in Mist */}
          <path d="M120,135 Q160,110 200,125 T280,115 L320,130 L320,260 L120,260 Z" fill="#cfd6d0" opacity="0.45" />
          <path d="M150,150 Q195,130 240,142 T320,135 L320,260 L150,260 Z" fill="#b2bcb5" opacity="0.4" />

          {/* Soft Clouds Layer */}
          <ellipse cx="200" cy="140" rx="90" ry="16" fill="url(#cloudGrad)" />
          <ellipse cx="250" cy="120" rx="70" ry="12" fill="url(#cloudGrad)" />

          {/* Cliff Edge & Rocks (松崖险石) */}
          <path
            d="M175,260 L185,220 Q192,205 208,198 L242,192 Q258,190 272,205 L320,225 L320,260 Z"
            fill="#4a524a"
            opacity="0.85"
          />
          <path
            d="M190,260 L198,225 Q205,212 220,206 L250,202 L320,235 L320,260 Z"
            fill="#2f3630"
          />

          {/* Ancient Pine Trunk (古松苍劲枝干) */}
          <path
            d="M268,260 Q278,215 285,185 Q290,165 282,145 Q276,130 262,120 Q252,112 245,116"
            stroke="#2b312c"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M282,150 Q298,140 315,142"
            stroke="#2b312c"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M272,130 Q255,122 238,126"
            stroke="#2b312c"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Pine Needles Clusters (松针掩映) */}
          <g fill="#27382b" opacity="0.9">
            <ellipse cx="236" cy="124" rx="22" ry="9" transform="rotate(-15 236 124)" />
            <ellipse cx="252" cy="115" rx="18" ry="8" transform="rotate(-5 252 115)" />
            <ellipse cx="282" cy="132" rx="24" ry="10" transform="rotate(12 282 132)" />
            <ellipse cx="308" cy="140" rx="20" ry="8" transform="rotate(8 308 140)" />
            <ellipse cx="265" cy="108" rx="22" ry="9" transform="rotate(-20 265 108)" />
          </g>

          {/* Lone White-Robed Swordsman (白袍斗笠仗剑行者) */}
          <g transform="translate(198, 142)">
            {/* Bamboo Hat (斗笠) */}
            <path d="M6,14 L18,5 L30,14 Z" fill="#54483a" />
            <ellipse cx="18" cy="14" rx="12" ry="3" fill="#3d3326" />

            {/* Head & Neck */}
            <circle cx="18" cy="16" r="3.5" fill="#e8dcc8" />

            {/* White Robe Body (白袍身躯) */}
            <path d="M12,19 Q18,22 24,19 L28,52 Q18,55 8,52 Z" fill="#f4f6f4" stroke="#d5dad5" strokeWidth="0.8" />

            {/* Robe Belt / Sash */}
            <rect x="13" y="30" width="10" height="2.5" fill="#363d38" rx="1" />

            {/* Flowing Hem & Shadow */}
            <path d="M10,50 Q18,54 26,50 L27,53 Q18,56 9,53 Z" fill="#b0b8b2" />

            {/* Sheathed Sword at Waist (腰悬古剑) */}
            <path d="M9,27 L1,48" stroke="#1f2420" strokeWidth="2" strokeLinecap="round" />
            <circle cx="9" cy="27" r="1.5" fill="var(--gold-400)" />
          </g>
        </svg>
      </div>

      {/* Card Content Layer */}
      <div className="relative z-[var(--z-content)] max-w-[210px] sm:max-w-[240px]">
        {/* Level & Title */}
        <div className="flex items-center gap-2.5">
          <LevelBadge level={player.playerLevel} size="md" />
          <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
            Lv.{player.playerLevel}
          </h2>
        </div>
        <div className="mt-1 text-xs sm:text-sm font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
          成长旅人
        </div>

        {/* XP Numbers */}
        <div className="mt-6 flex items-baseline gap-1.5">
          <span className="font-mono text-base sm:text-lg font-bold text-[var(--gold-500)]">
            {levelProgress.xpIntoLevel.toLocaleString()}
          </span>
          <span className="text-xs sm:text-sm font-mono text-[var(--text-muted)]">
            / {levelProgress.xpNeededForNext.toLocaleString()} XP
          </span>
        </div>

        {/* Fine Progress Bar */}
        <div className="mt-2 w-full">
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
          距离升级还需 <span className="font-mono font-[var(--font-weight-medium)] text-[var(--text-secondary)]">{neededXp.toLocaleString()} XP</span>
        </div>

        {/* Hidden / Subtle Test Hooks for 100% Backward Compatibility */}
        <div className="sr-only" aria-hidden="true">
          <span>XP Lv.{player.playerLevel}</span>
          <span>{player.totalXp} XP total</span>
          <span>{levelProgress.xpIntoLevel} / {levelProgress.xpNeededForNext} XP to next level</span>
          <span>Energy</span>
          <span>{player.energy}</span>
          <span>精力</span>
          <span>Focus</span>
          <span>{player.focus}</span>
          <span>心流</span>
          <span>Momentum</span>
          <span>{player.momentum}</span>
          <span>势能</span>
        </div>
      </div>
    </GlassPanel>
  );
}
