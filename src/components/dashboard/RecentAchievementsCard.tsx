"use client";

import React from "react";
import { ChevronRight, Lock, BookOpen, Target, Mountain } from "lucide-react";
import { GlassPanel } from "@/components/ui";

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  type: "mountain" | "book" | "target" | "streak";
}

export function RecentAchievementsCard() {
  const achievements: AchievementItem[] = [
    {
      id: "ach-1",
      title: "初见山巅",
      description: "达到 Lv.10",
      unlocked: true,
      type: "mountain",
    },
    {
      id: "ach-2",
      title: "博学者",
      description: "阅读 10 本书",
      unlocked: true,
      type: "book",
    },
    {
      id: "ach-3",
      title: "专注者",
      description: "单次专注 90 分钟",
      unlocked: true,
      type: "target",
    },
    {
      id: "ach-4",
      title: "持续精进",
      description: "连续 30 天打卡",
      unlocked: false,
      type: "streak",
    },
  ];

  return (
    <GlassPanel
      variant="base"
      border="default"
      className="p-5 rounded-2xl shadow-[var(--shadow-card)] flex flex-col justify-between min-h-[260px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-bold text-base text-[var(--text-primary)] tracking-wide">
          最近成就
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <span>查看全部</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 4 Eastern Medal Badges Grid (4枚东方金属圆形印章奖章) */}
      <div className="grid grid-cols-4 gap-2 my-auto py-2">
        {achievements.map((ach) => (
          <div key={ach.id} className="flex flex-col items-center text-center group">
            {/* Circular Medal Seal */}
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center relative p-1 transition-transform group-hover:scale-105 duration-200 ${
                ach.unlocked
                  ? "shadow-sm"
                  : "opacity-60"
              }`}
            >
              {/* Outer Fluted Bezel Ring */}
              <div
                className={`absolute inset-0 rounded-full border-2 ${
                  ach.unlocked
                    ? "border-[var(--gold-400)]/60 bg-gradient-to-b from-[#fefbf3] to-[#e8decb]"
                    : "border-[var(--border-default)] bg-[var(--surface-ground)]"
                }`}
              />

              {/* Inner Decorative Ring */}
              <div
                className={`absolute inset-1 rounded-full border ${
                  ach.unlocked
                    ? "border-[var(--gold-500)]/40 bg-gradient-to-br from-white/90 to-[#f5eedf]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                }`}
              />

              {/* Medal Icon Graphics */}
              <div className="relative z-10 flex items-center justify-center">
                {ach.type === "mountain" && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#608072] to-[#3b5448] flex items-center justify-center text-[#e8f2ec] shadow-inner">
                    <Mountain className="w-5 h-5 stroke-[2.2]" />
                  </div>
                )}
                {ach.type === "book" && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#997950] to-[#6d502f] flex items-center justify-center text-[#fcf6ea] shadow-inner">
                    <BookOpen className="w-4 h-4 stroke-[2.2]" />
                  </div>
                )}
                {ach.type === "target" && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#a34a36] to-[#782f20] flex items-center justify-center text-[#faece8] shadow-inner">
                    <Target className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>
                )}
                {ach.type === "streak" && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-b from-[#949da6] to-[#656e75] flex items-center justify-center text-[#e2e7eb] shadow-inner">
                    <Lock className="w-4 h-4 stroke-[2.2]" />
                  </div>
                )}
              </div>
            </div>

            {/* Medal Title & Description */}
            <div className="mt-2 space-y-0.5">
              <div className="font-serif text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)] truncate max-w-[70px]">
                {ach.title}
              </div>
              <div className="text-xs text-[var(--text-muted)] truncate max-w-[70px]">
                {ach.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
