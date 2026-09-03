"use client";

import React from "react";
import { Sparkles, Play, MessageSquarePlus } from "lucide-react";

export interface DashboardHeaderProps {
  userName?: string;
  onOpenAiDialogue?: () => void;
  onStartFocus?: () => void;
}

export function DashboardHeader({
  userName = "星野",
  onOpenAiDialogue,
  onStartFocus,
}: DashboardHeaderProps) {
  // Determine greeting based on current local hour
  const hour = new Date().getHours();
  let greetingTime = "晚上好";
  if (hour >= 5 && hour < 11) greetingTime = "早上好";
  else if (hour >= 11 && hour < 13) greetingTime = "中午好";
  else if (hour >= 13 && hour < 18) greetingTime = "下午好";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
      {/* Left: Greeting and Poetic Subtitle */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <span>{greetingTime}，{userName}</span>
          <Sparkles className="h-5 w-5 text-[var(--gold-400)] shrink-0 fill-[var(--gold-300)]/40" />
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 font-sans">
          你的成长旅程仍在继续，今天也比昨天更进一步。
        </p>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenAiDialogue}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)] bg-[var(--surface-base)] hover:bg-[var(--surface-raised)] border border-[var(--border-default)] shadow-xs transition-all hover:border-[var(--border-hover-neutral)] cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
        >
          <MessageSquarePlus className="h-4 w-4 text-[var(--gold-500)]" />
          <span>AI 导师对话</span>
        </button>

        <button
          type="button"
          onClick={onStartFocus}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-[var(--font-weight-semibold)] text-white bg-[var(--text-primary)] hover:bg-[#2c333d] shadow-sm transition-all cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] active:scale-[0.98]"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>开始专注</span>
        </button>
      </div>
    </div>
  );
}
