"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readOnboardingProgress, type OnboardingProgress } from "@/lib/onboarding/progress";

type GuideState =
  | { kind: "loading" }
  | { kind: "ready"; progress: OnboardingProgress; request: number; router: ReturnType<typeof useRouter> }
  | { kind: "configuration" | "error" | "unauthenticated" };

const linkClass = "inline-flex min-h-[var(--touch-target-min)] items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover-neutral)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]";
const steps = [
  { key: "mainQuest", title: "选定一条主线", href: "/quests", action: "管理主线",
    description: "在任务页面创建一个你真正想推进的目标，并勾选“主线任务”。已有进行中的主线会直接识别。", example: "示例：完成一个可展示的研究项目。" },
  { key: "skill", title: "建立技能目录", href: "/skills", action: "管理技能目录",
    description: "先把想练习的技能放进目录。手动建档初始为 XP=0、Level=1、M0、Confidence=0，不代表已经掌握；已有技能不会被重置。", example: "示例：数据分析、论文写作。" },
  { key: "activity", title: "保存一次真实行动", href: "/dashboard#quick-log-input", action: "去记录一次行动",
    description: "回到仪表盘，写下你实际做了什么、结果如何。已保存的文字记录会被识别，未提交的草稿不算。", example: "示例：复查了一组分析结果，发现并修正一个错误。" },
] as const;

export function GettingStartedGuide() {
  const router = useRouter();
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<GuideState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    async function load() {
      // Public build configuration only. Runtime equality is a separate controlled-launch gate.
      const configured = await Promise.resolve(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
        && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()));
      if (!current) return;
      if (!configured) { setState({ kind: "configuration" }); return; }
      setState({ kind: "loading" });
      try {
        const response = await fetch("/api/dashboard", {
          method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!current) return;
        if (response.status === 401) {
          setState({ kind: "unauthenticated" });
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("ONBOARDING_UNAVAILABLE");
        const receipt: unknown = await response.json();
        if (!current) return;
        const progress = readOnboardingProgress(receipt);
        setState({ kind: "ready", progress, request, router });
      } catch {
        if (current && !controller.signal.aborted) setState({ kind: "error" });
      }
    }
    void load();
    return () => { current = false; controller.abort(); };
  }, [request, router]);

  // Never render a prior request/router generation while its replacement is starting.
  const visibleState: GuideState = state.kind === "ready" && (state.request !== request || state.router !== router)
    ? { kind: "loading" } : state;
  const ready = visibleState.kind === "ready" ? visibleState.progress : null;
  const allReady = Boolean(ready?.mainQuest && ready.skill && ready.activity);
  function reload() { setState({ kind: "loading" }); setRequest(value => value + 1); }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6" aria-labelledby="getting-started-title">
      <header className="space-y-3">
        <p className="text-sm text-[var(--text-muted)]">从真实行动开始</p>
        <h1 id="getting-started-title" className="font-serif text-3xl font-bold text-[var(--text-primary)]">你的入门指南</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">先准备目标、技能目录和一条真实记录。你可以跳过、调整顺序，或随时回来；这不是考试，也不产生入门积分。</p>
        <Link href="/dashboard" prefetch={false} className={linkClass}>稍后再看，返回仪表盘</Link>
      </header>

      <section aria-label="资料核对" aria-live="polite" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
        {visibleState.kind === "loading" && <p role="status">正在核对已保存的资料…</p>}
        {visibleState.kind === "configuration" && <p role="alert">项目连接尚未配置，无法核对真实资料。当前不显示准备进度。</p>}
        {visibleState.kind === "error" && <div className="space-y-3"><p role="alert">暂时无法核对资料，请重试。当前不显示准备进度。</p><button type="button" onClick={reload} className={linkClass}>重新核对</button></div>}
        {visibleState.kind === "unauthenticated" && <p role="status">请先登录，正在前往登录页…</p>}
        {visibleState.kind === "ready" && <div className="flex flex-wrap items-center justify-between gap-3"><p role="status">{allReady ? "入门准备已完成" : "按自己的节奏准备即可"}</p><button type="button" onClick={reload} className={linkClass}>重新核对</button></div>}
      </section>

      <ol className="grid min-w-0 gap-4 md:grid-cols-3">
        {steps.map((step, index) => {
          const fact = ready?.[step.key];
          return <li key={step.key} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div><p className="text-xs text-[var(--text-muted)]">准备 {index + 1}</p><h2 className="mt-1 font-serif text-xl font-semibold text-[var(--text-primary)]">{step.title}</h2></div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{step.description}</p>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">{step.example}</p>
            <div className="break-words text-sm text-[var(--text-primary)]">
              <p>{ready ? (fact ? "已准备" : "尚未准备") : "尚未核对"}</p>
              {fact && <p className="mt-1" data-preparation-fact={step.key}>{fact.label}</p>}
            </div>
            <Link href={step.href} prefetch={false} className={`${linkClass} mt-auto`}>{step.action}</Link>
          </li>;
        })}
      </ol>

      <section className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-5" aria-labelledby="after-preparation-title">
        <h2 id="after-preparation-title" className="font-serif text-lg font-semibold text-[var(--text-primary)]">准备之后，会发生什么？</h2>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">记录存在不等于 AI 已成功评估、已确认或已获得 XP。AI 只生成 Proposal；经你确认后，服务器的确定性 Growth Engine 才会结算 XP。时间不是 XP，XP 也不等于 Mastery，高阶能力仍需要 Evidence。</p>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">这里只读取已保存的资料，不会替你创建目标、技能或记录，也不会自动评估、确认或发奖励。三步齐全只表示入门准备就绪，不代表整站或真实 AI 验收完成。</p>
      </section>
    </main>
  );
}
