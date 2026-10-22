"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCheck, ClipboardList, Footprints, NotebookPen, Target } from "lucide-react";
import type { DashboardSnapshot } from "@/lib/store/types";

interface TaskFirstGuideProps {
  dashboard: DashboardSnapshot;
  onQuickLog: () => void;
  onReview: () => void;
}
const actionClass = "inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]";
const steps = [
  { title: "选一件任务", description: "从进行中的目标里，挑一件接下来要做的小事。", icon: Target },
  { title: "去实际行动", description: "回到现实中去做。休息、暂停或换一件事也可以。", icon: Footprints },
  { title: "记录做了什么", description: "写下实际行动、结果或卡住的地方，不用先填完所有资料。", icon: NotebookPen },
  { title: "核对成长建议", description: "看 AI 是否理解准确，再决定确认、修改或拒绝。", icon: CheckCheck },
  { title: "回顾并选下一步", description: "结束时看看今天的记录，按需要做日、周或月复盘。", icon: ClipboardList },
];

export function TaskFirstGuide({ dashboard, onQuickLog, onReview }: TaskFirstGuideProps) {
  const quests = dashboard.quests ?? dashboard.activeQuests ?? (dashboard.mainQuest ? [dashboard.mainQuest] : []);
  const active = quests.filter(quest => quest.status === "active");
  const pending = dashboard.pendingAssessments.filter(assessment => assessment.status === "pending").length;
  return (
    <section aria-labelledby="task-first-title" className="min-w-0 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-5 sm:p-6" data-testid="task-first-guide">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-xs font-medium tracking-wide text-[var(--text-muted)]">每天从这里开始</p>
          <h2 id="task-first-title" className="font-serif text-2xl font-bold text-[var(--text-primary)]">今天，先推进一件事</h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{active.length ? "先从进行中的任务里选一件去做；做完以后，再回来记录和核对成长建议。" : "先选一个想推进的目标，并在任务页创建或激活任务；如果已经做过一件事，也可以直接记录。"}</p>
        </div>
        <Link href="/quests" prefetch={false} className={`${actionClass} shrink-0 font-semibold`}>
          {active.length ? "选择接下来要做的任务" : "去设置我的目标"}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <ol aria-label="日常使用流程" className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return <li key={step.title} className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3.5">
            <div className="flex items-center gap-2 text-[var(--text-primary)]"><span className="font-mono text-xs text-[var(--text-muted)]">0{index + 1}</span><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><h3 className="text-sm font-semibold">{step.title}</h3></div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{step.description}</p>
            <div className="mt-auto pt-1">
              {index === 0 && <Link href="/quests" prefetch={false} className={actionClass}>打开任务</Link>}
              {index === 2 && <button type="button" className={actionClass} onClick={onQuickLog}>去记录结果</button>}
              {index === 3 && <button type="button" className={actionClass} onClick={onReview}>{pending ? `核对建议（${pending}）` : "查看待核对建议"}</button>}
              {index === 4 && <Link href="/journey/reviews" prefetch={false} className={actionClass}>去复盘</Link>}
            </div>
          </li>;
        })}
      </ol>
      {pending > 0 && <p className="mt-4 text-sm text-[var(--text-secondary)]" role="status">你还有 {pending} 条成长建议待核对。这些建议尚未结算，可以稍后处理。</p>}
      <details className="mt-4 border-t border-[var(--border-subtle)] pt-3">
        <summary className="min-h-[var(--touch-target-min)] cursor-pointer content-center rounded-lg text-sm text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]">其他功能什么时候用？</summary>
        <p className="my-2 text-xs leading-relaxed text-[var(--text-muted)]">按需要打开即可，不用每天把每个页面都走一遍。</p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {[['/skills', '技能谱', '想看自己会什么、能力如何变化时'], ['/knowledge', '知识图', '想梳理概念与知识联系时'], ['/artifacts', '产出台', '想整理可复用的代码、笔记或作品时'], ['/local-library', '本地资料', '想从文件中整理行动线索时；核对并同意后再交给 AI']].map(([href, title, description]) => <Link key={href} href={href} prefetch={false} className={`${actionClass} min-w-0 flex-col items-start text-left`}><span className="font-medium">{title}</span><span className="text-xs leading-relaxed text-[var(--text-secondary)]">{description}</span></Link>)}
        </div>
      </details>
    </section>
  );
}
