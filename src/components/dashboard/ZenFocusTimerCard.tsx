"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, ChevronDown, Maximize2 } from "lucide-react";
import { GlassPanel } from "@/components/ui";

export interface ZenFocusTimerCardProps {
  initialMinutes?: number;
  todayFocusedText?: string;
  onFocusComplete?: (minutes: number) => void;
}

export function ZenFocusTimerCard({
  initialMinutes = 25,
  todayFocusedText = "今日专注 2 小时 15 分钟",
  onFocusComplete,
}: ZenFocusTimerCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onFocusComplete?.(initialMinutes);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, initialMinutes, onFocusComplete]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const progress = (1 - secondsLeft / (initialMinutes * 60)) * 100;
  // Circumference of r=52 is 2 * PI * 52 ≈ 326.7
  const strokeDashoffset = 326.7 - (326.7 * progress) / 100;

  return (
    <GlassPanel
      variant="base"
      border="default"
      className="p-5 rounded-2xl shadow-[var(--shadow-card)] flex flex-col justify-between min-h-[260px]"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-bold text-base text-[var(--text-primary)] tracking-wide">
          专注计时器
        </h3>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <span>专注模式</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="全屏"
            className="p-1 rounded-md hover:bg-[var(--surface-hover-neutral)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Center Circular Zen Timer Dial (水墨环形表盘) */}
      <div className="flex flex-col items-center justify-center my-1 relative">
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Background Track Ring */}
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="4"
            />
            {/* Subtle Bamboo-Ink Dashed Ring */}
            <circle
              cx="60"
              cy="60"
              r="47"
              fill="none"
              stroke="var(--border-default)"
              strokeWidth="1"
              strokeDasharray="2 6"
              opacity="0.6"
            />
            {/* Dynamic Gold Progress Arc */}
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#timerGoldGrad)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray="326.7"
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
            <defs>
              <linearGradient id="timerGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--gold-400)" />
                <stop offset="100%" stopColor="var(--gold-300)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Dial Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
            <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-muted)] tracking-wider">
              {isRunning ? "专注中" : "准备就绪"}
            </span>
            <span className="font-serif text-3xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums mt-0.5">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Play / Pause Toggle Button */}
        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-hover-neutral)] shadow-xs transition-all cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
        >
          {isRunning ? (
            <>
              <Pause className="h-3 w-3 fill-current" />
              <span>暂停</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" />
              <span>开始</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom Subtext */}
      <div className="text-center text-xs text-[var(--text-muted)] font-sans">
        {todayFocusedText}
      </div>
    </GlassPanel>
  );
}
