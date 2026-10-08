"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SecondaryButton } from "@/components/ui";

export const fieldClass = "w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]";
export const labelClass = "flex min-w-0 flex-col gap-1.5 text-sm text-[var(--text-secondary)]";
export const cardClass = "min-w-0 space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 [overflow-wrap:anywhere]";
const messages = new Map([
  ["UNAUTHORIZED", "登录已失效，请重新登录。"],
  ["MILESTONE_NOT_FOUND", "成就不存在或已无法访问。"],
  ["MILESTONE_SOURCE_NOT_FOUND", "来源不存在或已无法访问。"],
  ["MILESTONE_SOURCE_NOT_ELIGIBLE", "来源尚不满足成就认定条件，没有新增认定。"],
  ["MILESTONE_ALREADY_EXISTS", "该事实已有成就记录，撤销后的历史也不能重复认定。"],
  ["MILESTONE_ALREADY_REVOKED", "这条成就已撤销，请重新读取历史。"],
  ["MILESTONE_NOT_SETTLEABLE", "当前成就不能结算，请重新读取状态。"],
  ["REWARD_ALREADY_MINTED_FOR_SOURCE", "该来源已发放过奖励，不能重复发放或关联。"],
  ["REWARD_SOURCE_NOT_ELIGIBLE", "来源未满足奖励条件，没有发放积分。"],
  ["INELIGIBLE_FOR_REWARD", "此类成就暂不开放奖励。"],
  ["IDEMPOTENCY_KEY_REUSED", "请求标识已绑定不同内容。请核对历史后结束本次尝试，不要修改原请求重试。"],
  ["PROPOSAL_ALREADY_REVIEWED", "提案已经审核，请重新读取结果。"],
  ["PROPOSAL_EXPIRED", "提案已过期，不能继续审核。"],
  ["PAYLOAD_VALIDATION_FAILED", "提案内容不符合成就契约，没有新增认定。"],
  ["SCHEMA_VALIDATION_FAILED", "此版本不支持认定，请保留原始提案。"],
  ["FORBIDDEN", "当前操作不被允许，请核对登录和记录状态。"],
]);
export class MilestoneClientError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
}
export function errorOf(error: unknown) { return error instanceof Error ? error : new Error("操作未完成，请重试。"); }
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export async function milestoneRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new MilestoneClientError("连接中断，操作结果尚未确认。请保留原请求重试，或只读取历史核对。");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isObject(body) && typeof body.code === "string" ? body.code : "";
    throw new MilestoneClientError(response.status === 401 ? messages.get("UNAUTHORIZED")!
      : messages.get(code) ?? `请求未完成（${response.status}），请核对历史后重试。`, response.status);
  }
  if (!isObject(body)) throw new MilestoneClientError("响应无法确认操作结果，请重试同一请求或读取历史核对。");
  return body as T;
}
export function ErrorNotice({ error, retry }: { error: Error | null; retry?: () => void }) {
  if (!error) return null;
  return <div role="alert" className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-default)] p-3 text-sm [overflow-wrap:anywhere]">
    <p>{error.message}</p>
    {error instanceof MilestoneClientError && error.status === 401
      ? <Link className="underline" href="/login">重新登录</Link>
      : retry && <SecondaryButton size="sm" onClick={retry}>重新读取</SecondaryButton>}
  </div>;
}
export function dateText(value: string | null) {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN");
}
export function JsonText({ value }: { value: unknown }) {
  return <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs [overflow-wrap:anywhere]">{JSON.stringify(value, null, 2)}</pre>;
}

type Tag = { url: string; field: string; revision: number; attempt: number };
type Collection<T> = { tag: Tag | null; items: T[]; next: number | null; error: Error | null };
export function useMilestonePage<T extends { id: string }>(url: string, field: string, revision: number) {
  const [attempt, setAttempt] = useState(0);
  const tag = useMemo(() => ({ url, field, revision, attempt }), [url, field, revision, attempt]);
  const [state, setState] = useState<Collection<T>>({ tag: null, items: [], next: null, error: null });
  const [morePending, setMorePending] = useState<Tag | null>(null);
  const moreLock = useRef<Tag | null>(null);
  const read = useCallback(async (offset: number, signal?: AbortSignal) => {
    const body = await milestoneRequest<Record<string, unknown>>(`${url}${url.includes("?") ? "&" : "?"}limit=20&offset=${offset}`, { signal });
    const items = body[field];
    if (!Array.isArray(items) || items.some(item => !isObject(item) || typeof item.id !== "string") ||
      !(body.nextOffset === null || (Number.isSafeInteger(body.nextOffset) && Number(body.nextOffset) > offset && Number(body.nextOffset) <= 2147483547))) {
      throw new Error("分页响应无效，请重新读取。");
    }
    return { items: items as T[], next: body.nextOffset as number | null };
  }, [url, field]);
  useEffect(() => {
    const controller = new AbortController();
    void read(0, controller.signal).then(page => {
      if (!controller.signal.aborted) setState({ tag, ...page, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ tag, items: [], next: null, error: errorOf(error) });
    });
    return () => controller.abort();
  }, [tag, read]);
  async function more() {
    if (moreLock.current === tag || state.tag !== tag || state.next === null) return;
    moreLock.current = tag; setMorePending(tag);
    try {
      const page = await read(state.next);
      setState(previous => previous.tag === tag ? {
        tag, items: Array.from(new Map([...previous.items, ...page.items].map(item => [item.id, item])).values()), next: page.next, error: null,
      } : previous);
    } catch (error) {
      setState(previous => previous.tag !== tag ? previous
        : error instanceof MilestoneClientError && error.status === 401
          ? { tag, items: [], next: null, error }
          : { ...previous, error: errorOf(error) });
    }
    finally {
      if (moreLock.current === tag) moreLock.current = null;
      setMorePending(previous => previous === tag ? null : previous);
    }
  }
  const ready = state.tag === tag;
  return { items: ready ? state.items : [], next: ready ? state.next : null, error: ready ? state.error : null,
    loading: !ready, moreBusy: morePending === tag, more, retry: () => setAttempt(value => value + 1) };
}
export function MoreButton({ next, busy, onClick }: { next: number | null; busy: boolean; onClick: () => void }) {
  return next !== null && <SecondaryButton loading={busy} onClick={onClick}>加载更多</SecondaryButton>;
}
