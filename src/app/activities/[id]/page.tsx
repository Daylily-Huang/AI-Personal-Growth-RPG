"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isValidUuid } from "@/lib/http/validation";
import type { Activity } from "@/lib/store/types";
import { EvidenceSubmissionPanel } from "@/components/activities/EvidenceSubmissionPanel";

type Detail = Pick<Activity, "id" | "title" | "rawInput" | "status" | "createdAt" | "rulesVersion">;
type State = { kind: "loading" | "configuration" | "invalid" | "notFound" | "error" | "unauthenticated" }
  | { kind: "ready"; activity: Detail; request: number; router: ReturnType<typeof useRouter> };
const linkClass = "inline-flex min-h-[var(--touch-target-min)] items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover-neutral)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]";
const statusLabels = { pending_assessment: "已保存，待评估", assessed: "已评估，尚未确认", confirmed: "已确认" };

function own(object: unknown, key: string): unknown {
  if (!object || typeof object !== "object" || Array.isArray(object)) return undefined;
  const prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}
function readDetail(receipt: unknown, id: string): Detail {
  const activity = own(receipt, "activity");
  const fields = Object.fromEntries(["id", "title", "rawInput", "status", "createdAt", "rulesVersion"]
    .map(key => [key, own(activity, key)]));
  if (!isValidUuid(fields.id) || fields.id.toLowerCase() !== id.toLowerCase()
    || !["title", "rawInput", "createdAt", "rulesVersion"].every(key => typeof fields[key] === "string")
    || !Number.isFinite(Date.parse(fields.createdAt as string))
    || !["pending_assessment", "assessed", "confirmed"].includes(fields.status as string)) {
    throw new Error("ACTIVITY_RECEIPT_INVALID");
  }
  return fields as Detail;
}

function ActivityDetail({ id }: { id: string }) {
  const router = useRouter();
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    async function load() {
      const configured = await Promise.resolve(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
        && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()));
      if (!current) return;
      if (!configured) { setState({ kind: "configuration" }); return; }
      if (!isValidUuid(id)) { setState({ kind: "invalid" }); return; }
      setState({ kind: "loading" });
      try {
        const response = await fetch(`/api/activities/${encodeURIComponent(id)}`, {
          method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!current) return;
        if (response.status === 401) {
          setState({ kind: "unauthenticated" }); router.replace("/login"); return;
        }
        if (response.status === 404) { setState({ kind: "notFound" }); return; }
        if (response.status === 400) { setState({ kind: "invalid" }); return; }
        if (response.status === 503) { setState({ kind: "configuration" }); return; }
        if (!response.ok) throw new Error("ACTIVITY_UNAVAILABLE");
        const receipt: unknown = await response.json();
        if (!current) return;
        setState({ kind: "ready", activity: readDetail(receipt, id), request, router });
      } catch {
        if (current && !controller.signal.aborted) setState({ kind: "error" });
      }
    }
    void load();
    return () => { current = false; controller.abort(); };
  }, [id, request, router]);
  const visible: State = state.kind === "ready" && (state.request !== request || state.router !== router)
    ? { kind: "loading" } : state;
  function reload() { setState({ kind: "loading" }); setRequest(value => value + 1); }
  return <section aria-label="活动详情" aria-live="polite" className="min-w-0 space-y-5">
    {visible.kind === "loading" && <p role="status">正在读取活动原文…</p>}
    {visible.kind === "unauthenticated" && <p role="status">请先登录，正在前往登录页…</p>}
    {visible.kind === "configuration" && <p role="alert">项目连接尚未配置，无法读取真实活动。</p>}
    {visible.kind === "invalid" && <p role="alert">活动地址无效，请从你的活动记录重新打开。</p>}
    {visible.kind === "notFound" && <p role="alert">未找到可访问的活动，请返回你的活动记录。</p>}
    {visible.kind === "error" && <div className="space-y-3"><p role="alert">暂时无法读取活动，请重试。</p><button type="button" onClick={reload} className={linkClass}>重新读取</button></div>}
    {visible.kind === "ready" && <>
      <div className="min-w-0 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 sm:p-6">
        <h2 className="break-words font-serif text-xl font-semibold [overflow-wrap:anywhere]">{visible.activity.title}</h2>
        <dl className="grid min-w-0 gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
          <div><dt>记录状态</dt><dd>{statusLabels[visible.activity.status]}</dd></div>
          <div><dt>创建时间</dt><dd><time dateTime={visible.activity.createdAt}>{new Date(visible.activity.createdAt).toLocaleString()}</time></dd></div>
          <div className="min-w-0"><dt>记录 ID</dt><dd className="font-mono [overflow-wrap:anywhere]">{visible.activity.id}</dd></div>
          <div className="min-w-0"><dt>记录时的规则版本</dt><dd className="[overflow-wrap:anywhere]">{visible.activity.rulesVersion}</dd></div>
        </dl>
        <button type="button" onClick={reload} className={linkClass}>重新读取</button>
      </div>
      <section aria-labelledby="activity-original-title" className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 sm:p-6">
        <h2 id="activity-original-title" className="mb-4 font-serif text-lg font-semibold">原始输入</h2>
        <pre data-testid="activity-raw-input" className="min-w-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--text-primary)] [overflow-wrap:anywhere]">{visible.activity.rawInput}</pre>
      </section>
      <EvidenceSubmissionPanel activityId={visible.activity.id} />
    </>}
  </section>;
}

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  return <main className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 py-8 sm:px-6" aria-labelledby="activity-detail-title">
    <header className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">回到真实行动</p>
      <h1 id="activity-detail-title" className="font-serif text-3xl font-bold text-[var(--text-primary)]">活动原文</h1>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">这里只读取你保存的记录，不会自动评估、确认或改变 XP。记录状态不等于 Mastery 或奖励。</p>
      <Link href="/dashboard" prefetch={false} className={linkClass}>返回仪表盘</Link>
    </header>
    <ActivityDetail key={id} id={id} />
  </main>;
}
