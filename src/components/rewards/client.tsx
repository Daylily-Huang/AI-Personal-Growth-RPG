"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SecondaryButton } from "@/components/ui";
import type { Wish, WishStatus } from "@/lib/reward/types";

export const fieldClass = "w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-ground)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]";
export const labelClass = "flex min-w-0 flex-col gap-1.5 text-sm text-[var(--text-secondary)]";
export const rowClass = "min-w-0 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 [overflow-wrap:anywhere]";
export const statusText: Record<WishStatus, string> = {
  IDEA: "构想", ACTIVE: "已激活", PRIMARY: "当前目标", RESERVED: "已预留", REDEEMED: "已兑换", ARCHIVED: "已归档", CANCELLED: "已取消",
};
const messages: Record<string, string> = {
  UNAUTHORIZED: "登录已失效，请重新登录。", WISH_NOT_FOUND: "心愿不存在或已无法访问。",
  INSUFFICIENT_REWARD_CREDITS: "可用奖励积分不足，未作任何扣除。",
  REDEMPTION_COOLDOWN_ACTIVE: "仍在兑换后的七天冷却期内，暂时不能再次预留。",
  SELECTED_WISH_ALREADY_EXISTS: "已有当前目标。请先处理该目标，再选择新的心愿。",
  REWARD_SOURCE_ALREADY_GRANTED: "这个来源已领取过奖励，不会重复发放。",
  REWARD_SOURCE_NOT_ELIGIBLE: "来源尚未满足确定性奖励标准，未发放积分。",
  REWARD_SOURCE_NOT_FOUND: "来源不存在或已无法访问。",
  REWARD_TRANSACTION_ALREADY_CORRECTED: "这笔发放已修正，历史记录保持不变。",
  REDEMPTION_ALREADY_REFUNDED: "这次兑换已退款，不会再次退回积分。",
  IDEMPOTENCY_KEY_REUSED: "请求与原操作不一致。请刷新核对状态后重新操作。",
  INVALID_WISH_TRANSITION: "心愿状态已改变，请刷新后重试。",
  SOURCE_CLASS_NOT_YET_AVAILABLE: "此类来源暂未开放奖励。",
  FARMING_SOURCE_REJECTED: "日常使用或重复打卡不能领取奖励积分。",
  WISH_COST_REQUIRED: "请先为心愿设置正整数积分预算。",
  FORBIDDEN: "当前状态不允许这项修改，请刷新核对。",
  PROPOSAL_ALREADY_REVIEWED: "提案已审核，请刷新查看结果。",
  PROPOSAL_EXPIRED: "提案已过期，不能再接受。",
};
export class RewardClientError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
}
export async function rewardRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new RewardClientError("网络中断，操作结果尚未确认。可重试同一请求，或刷新核对状态。");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.code ?? body?.error;
    throw new RewardClientError(messages[code] ?? `请求未完成（${response.status}），请核对状态后重试。`, response.status);
  }
  if (!body || typeof body !== "object") throw new RewardClientError("未收到有效响应，请重试同一请求或刷新核对。");
  return body as T;
}
export function ErrorNotice({ error, retry }: { error: Error | null; retry?: () => void }) {
  if (!error) return null;
  return <div role="alert" className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-default)] p-3 text-sm text-[var(--text-primary)] [overflow-wrap:anywhere]">
    <p>{error.message}</p>
    {error instanceof RewardClientError && error.status === 401
      ? <Link className="underline" href="/login">重新登录</Link>
      : retry && <SecondaryButton size="sm" onClick={retry}>重新读取</SecondaryButton>}
  </div>;
}
export function errorOf(error: unknown): Error { return error instanceof Error ? error : new Error("操作失败，请重试。"); }
export function dateText(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN"); }

type RequestTag = { url: string | null; field: string; revision: number; attempt: number };
type Collection<T> = { tag: RequestTag | null; items: T[]; next: number | null; error: Error | null };
export function useRewardPage<T extends { id: string }>(url: string | null, field: string, revision: number) {
  const [attempt, setAttempt] = useState(0);
  // Object identity distinguishes A -> B -> A: equal URLs are not the same read generation.
  const tag = useMemo(() => ({ url, field, revision, attempt }), [url, field, revision, attempt]);
  const [state, setState] = useState<Collection<T>>({ tag: null, items: [], next: null, error: null });
  const [morePending, setMorePending] = useState<RequestTag | null>(null);
  const moreLock = useRef<RequestTag | null>(null);
  const read = useCallback(async (offset: number, signal?: AbortSignal) => {
    const body = await rewardRequest<Record<string, unknown>>(`${url}${url?.includes("?") ? "&" : "?"}limit=20&offset=${offset}`, { signal });
    if (!Array.isArray(body[field]) || !(body.nextOffset === null || (Number.isSafeInteger(body.nextOffset) && Number(body.nextOffset) > offset))) {
      throw new Error("分页响应无效，请重新读取。");
    }
    return { items: body[field] as T[], next: body.nextOffset as number | null };
  }, [url, field]);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    void read(0, controller.signal).then(page => {
      if (!controller.signal.aborted) setState({ tag, ...page, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ tag, items: [], next: null, error: errorOf(error) });
    });
    return () => controller.abort();
  }, [url, tag, read]);
  async function more() {
    if (moreLock.current === tag || state.tag !== tag || state.next === null) return;
    moreLock.current = tag; setMorePending(tag);
    try {
      const page = await read(state.next);
      setState(previous => previous.tag === tag ? {
        tag, items: Array.from(new Map([...previous.items, ...page.items].map(item => [item.id, item])).values()), next: page.next, error: null,
      } : previous);
    } catch (error) { setState(previous => previous.tag === tag ? { ...previous, error: errorOf(error) } : previous); }
    finally {
      if (moreLock.current === tag) moreLock.current = null;
      setMorePending(previous => previous === tag ? null : previous);
    }
  }
  const ready = Boolean(url) && state.tag === tag;
  return { items: ready ? state.items : [], next: ready ? state.next : null, error: ready ? state.error : null,
    loading: Boolean(url) && !ready, moreBusy: morePending === tag, more, retry: () => setAttempt(value => value + 1) };
}
export function MoreButton({ next, busy, onClick }: { next: number | null; busy: boolean; onClick: () => void }) {
  return next !== null && <SecondaryButton loading={busy} onClick={onClick}>加载更多</SecondaryButton>;
}

/** Read-only pagination, not a new selected-Wish authority. Never infer absence from page one. */
export async function readSelectedWish(signal: AbortSignal): Promise<Wish | null> {
  let offset: number | null = 0;
  while (offset !== null) {
    const page: { wishes: Wish[]; nextOffset: number | null } = await rewardRequest(`/api/rewards/wishes?limit=100&offset=${offset}`, { signal });
    if (!Array.isArray(page.wishes)) throw new Error("当前目标读取失败。");
    const selected = page.wishes.find(wish => wish.status === "PRIMARY" || wish.status === "RESERVED");
    if (selected) return selected;
    if (page.nextOffset !== null && (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset)) throw new Error("当前目标分页无效。");
    offset = page.nextOffset;
  }
  return null;
}
