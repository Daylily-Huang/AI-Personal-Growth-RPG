"use client";
import Link from "next/link";
export function RecoveryPanel({ notFound = false, onRetry, retrying = false }: { notFound?: boolean; onRetry?: () => void; retrying?: boolean }) {
  const action = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-raised)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-hover-neutral)]";
  return <section aria-labelledby="recovery-title" className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-6 text-[var(--text-primary)] sm:p-8">
    <p className="text-xs tracking-widest text-[var(--text-muted)]">{notFound ? "404 · 页面不存在" : "页面暂时无法显示"}</p>
    <h1 id="recovery-title" className="font-serif text-2xl">{notFound ? "这个入口没有找到" : "这一步没能顺利加载"}</h1>
    <p className="text-sm leading-7 text-[var(--text-secondary)]">{notFound ? "链接可能已经变更，或地址输入有误。你可以回到今天，继续推进目标。" : "请稍后重试。如果刚刚提交过记录，请先查看它的状态，再决定是否重新提交，避免重复操作。"}</p>
    <div className="flex flex-wrap gap-3">{onRetry && <button type="button" onClick={onRetry} disabled={retrying} className={action + " disabled:opacity-50"}>{retrying ? "正在重新加载…" : "重新加载此页"}</button>}<Link href="/dashboard" className={action}>回到今天</Link><Link href="/help" className={action}>查看使用帮助</Link></div>
  </section>;
}
