"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Pencil,
  X,
  XCircle,
} from "lucide-react";
import type {
  Domain,
  SkillDetailResponse,
  SkillDerivedState,
} from "@/lib/store/types";
import EvidenceTimeline from "./EvidenceTimeline";
import { formatConfidence, formatTimestamp, getSkillStateVisual } from "./presentation";

const MASTERY_LADDER = Array.from({ length: 11 }, (_, i) => i);

function MasteryHistoryEventType({ eventType }: { eventType: string }) {
  const label =
    eventType === "upgrade"
      ? "升级"
      : eventType === "request_verification"
        ? "待验证"
        : eventType;
  return <span className="font-medium text-zinc-300">{label}</span>;
}

export default function SkillDetailPanel({
  skillId,
  domains,
  onClose,
  onFocusSkill,
  onChanged,
}: {
  skillId: string;
  domains: Domain[];
  onClose: () => void;
  onFocusSkill: (skillId: string) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<SkillDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    aliases: "",
    description: "",
    domainId: "",
  });

  // The page mounts this panel with key={skillId}, so all fetch state resets
  // via remount; every setState below happens after an await (no sync
  // setState inside effect bodies — react-hooks/set-state-in-effect).
  const doFetchDetail = useCallback(async (): Promise<SkillDetailResponse | null> => {
    const res = await fetch(`/api/skills/${skillId}`);
    if (res.status === 401) {
      router.push("/login");
      return null;
    }
    if (!res.ok) throw new Error("加载技能详情失败");
    return (await res.json()) as SkillDetailResponse;
  }, [router, skillId]);

  useEffect(() => {
    let ignore = false;
    doFetchDetail()
      .then((data) => {
        if (!ignore && data) setDetail(data);
      })
      .catch((e) => {
        if (!ignore) setError(e instanceof Error ? e.message : "未知错误");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [doFetchDetail]);

  /** Event-handler path: explicit refresh with loading indicators. */
  function reload() {
    setLoading(true);
    setError(null);
    doFetchDetail()
      .then((data) => {
        if (data) setDetail(data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "未知错误");
      })
      .finally(() => setLoading(false));
  }

  function openEditor() {
    if (!detail) return;
    setForm({
      name: detail.skill.name,
      aliases: detail.skill.aliases.join(", "),
      description: detail.skill.description ?? "",
      domainId: detail.skill.domainId ?? "",
    });
    setSaveError(null);
    setEditing(true);
  }

  async function patchSkill(body: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.push("/login");
        return false;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `更新失败（${res.status}）`);
      }
      reload();
      onChanged();
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "未知错误");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (form.name.trim() === "") {
      setSaveError("名称不能为空");
      return;
    }
    const ok = await patchSkill({
      name: form.name,
      aliases: form.aliases
        .split(/[,，]/)
        .map((a) => a.trim())
        .filter(Boolean),
      description: form.description.trim() === "" ? null : form.description,
      domainId: form.domainId === "" ? null : form.domainId,
    });
    if (ok) setEditing(false);
  }

  async function toggleArchive() {
    if (!detail) return;
    const next = detail.skill.derivedState === "archived" ? "active" : "archived";
    await patchSkill({ status: next });
  }

  const stateVisual: ReturnType<typeof getSkillStateVisual> | null = detail
    ? getSkillStateVisual(detail.skill.derivedState as SkillDerivedState)
    : null;

  const progress =
    detail && detail.skill.nextLevelXp > 0
      ? Math.min(100, Math.round((detail.skill.xp / detail.skill.nextLevelXp) * 100))
      : detail
        ? 100
        : 0;

  return (
    <div className="flex h-full flex-col" aria-label="技能详情面板">
      {/* Panel header */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {loading || !detail ? (
              <div className="h-6 w-36 animate-pulse rounded bg-white/10" />
            ) : (
              <h2 className="truncate text-base font-semibold text-zinc-100" title={detail.skill.name}>
                {detail.skill.name}
              </h2>
            )}
            {!loading && detail ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {detail.skill.domainName ? (
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {detail.skill.domainName}
                  </span>
                ) : null}
                {detail.skill.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-300"
                  >
                    {alias}
                  </span>
                ))}
                {stateVisual ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${stateVisual.badgeClass}`}
                  >
                    {stateVisual.label}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!loading && detail ? (
              <>
                <button
                  type="button"
                  onClick={openEditor}
                  aria-label="编辑技能元数据"
                  title="编辑元数据"
                  className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleArchive}
                  disabled={saving}
                  aria-label={
                    detail.skill.derivedState === "archived" ? "取消归档" : "归档技能"
                  }
                  title={detail.skill.derivedState === "archived" ? "取消归档" : "归档"}
                  className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50"
                >
                  {detail.skill.derivedState === "archived" ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭详情面板"
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.06]" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              重试
            </button>
          </div>
        ) : detail ? (
          <>
            {/* Description (Stage 5B field; null → explicit empty state) */}
            <section aria-label="技能描述">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                描述
              </h3>
              {detail.skill.description ? (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
                  {detail.skill.description}
                </p>
              ) : (
                <p className="text-xs text-zinc-600">暂无描述。</p>
              )}
            </section>

            {/* Progression */}
            <section aria-label="等级与掌握进度" className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Lv.{detail.skill.level}</span>
                  <span>
                    {detail.skill.xp} / {detail.skill.nextLevelXp} XP
                  </span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="等级经验进度"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-400">掌握阶梯</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {MASTERY_LADDER.map((m) => (
                    <span
                      key={m}
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        m === detail.skill.masteryLevel
                          ? "bg-sky-500/30 font-bold text-sky-200 ring-1 ring-sky-400/60"
                          : m < detail.skill.masteryLevel
                            ? "bg-sky-500/10 text-sky-300/70"
                            : "bg-white/5 text-zinc-600"
                      }`}
                    >
                      M{m}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span
                    title="置信度反映系统对该掌握等级的确定程度；≥50% 视为证据稳固"
                    className="cursor-help underline decoration-dotted decoration-zinc-600 underline-offset-2"
                  >
                    掌握置信度
                  </span>
                  <span>{formatConfidence(detail.skill.masteryConfidence)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-sky-400"
                    style={{ width: `${Math.round(detail.skill.masteryConfidence * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-0.5 text-[11px] text-zinc-500">
                <div>
                  上次使用：
                  {detail.skill.lastUsedAt ? (
                    <time dateTime={detail.skill.lastUsedAt}>
                      {formatTimestamp(detail.skill.lastUsedAt)}
                    </time>
                  ) : (
                    "从未使用"
                  )}
                </div>
                <div>
                  创建于：
                  <time dateTime={detail.skill.createdAt}>
                    {formatTimestamp(detail.skill.createdAt)}
                  </time>
                </div>
              </div>
            </section>

            {/* Prerequisites */}
            <section aria-label="前置清单">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                前置技能（M≥2 且置信≥50% 视为满足）
              </h3>
              {detail.prerequisites.length === 0 ? (
                <p className="text-xs text-zinc-500">无前置技能。</p>
              ) : (
                <ul className="space-y-1">
                  {detail.prerequisites.map((prereq) => (
                    <li key={prereq.id}>
                      <button
                        type="button"
                        onClick={() => onFocusSkill(prereq.id)}
                        className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-white/10 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                      >
                        {prereq.isFulfilled ? (
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-zinc-200">{prereq.name}</span>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          M{prereq.masteryLevel} · {formatConfidence(prereq.masteryConfidence)}
                        </span>
                        <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 text-zinc-600" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Next unlocks */}
            <section aria-label="下一步解锁">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                下一步可解锁
              </h3>
              {detail.nextUnlocks.length === 0 ? (
                <p className="text-xs text-zinc-500">暂无依赖此技能的后续解锁。</p>
              ) : (
                <ul className="grid grid-cols-1 gap-1.5">
                  {detail.nextUnlocks.map((unlock) => {
                    const uv = getSkillStateVisual(unlock.derivedState as SkillDerivedState);
                    return (
                      <li key={unlock.id}>
                        <button
                          type="button"
                          onClick={() => onFocusSkill(unlock.id)}
                          className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-left text-xs transition-colors hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                        >
                          <span className="min-w-0 flex-1 truncate text-zinc-200">{unlock.name}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${uv.badgeClass}`}>
                            {uv.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Evidence timeline */}
            <section aria-label="证据时间线">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                证据与审计
              </h3>
              <EvidenceTimeline items={detail.evidenceTimeline} />
            </section>

            {/* Mastery history */}
            <section aria-label="掌握历史">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                掌握变更历史
              </h3>
              {detail.masteryHistory.length === 0 ? (
                <p className="text-xs text-zinc-500">暂无掌握等级变更记录。</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.masteryHistory.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                        <MasteryHistoryEventType eventType={event.eventType} />
                        <span className="font-mono text-zinc-400">
                          M{event.fromLevel}→M{event.toLevel}
                        </span>
                        <span
                          className="shrink-0 rounded bg-sky-400/10 px-1 py-0.5 font-mono text-[10px] text-sky-300"
                          title="变更时的掌握置信度快照"
                        >
                          置信 {formatConfidence(event.confidence)}
                        </span>
                        <span className="ml-auto shrink-0 text-zinc-500">
                          <time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time>
                        </span>
                      </div>
                      {event.reason ? (
                        <p
                          className="mt-1 line-clamp-2 pl-[22px] leading-relaxed text-zinc-400"
                          title={event.reason}
                        >
                          {event.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent transactions */}
            <section aria-label="近期经验记录">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                近期 XP 记录
              </h3>
              {detail.recentTransactions.length === 0 ? (
                <p className="text-xs text-zinc-500">暂无经验记录。</p>
              ) : (
                <ul className="space-y-1">
                  {detail.recentTransactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] hover:bg-white/5"
                    >
                      <span className="w-14 shrink-0 font-mono text-amber-300">
                        +{tx.amount} XP
                      </span>
                      <span className="min-w-0 flex-1 truncate text-zinc-400" title={tx.reason}>
                        {tx.reason}
                      </span>
                      <time dateTime={tx.createdAt} className="shrink-0 text-zinc-500">
                        {formatTimestamp(tx.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Future hooks — reserved containers, intentionally inert */}
            <section aria-label="预留区块" className="grid grid-cols-2 gap-2 pb-2">
              <div className="rounded-lg border border-dashed border-white/10 p-2.5 text-center text-[10px] text-zinc-600">
                相关任务（预留）
              </div>
              <div className="rounded-lg border border-dashed border-white/10 p-2.5 text-center text-[10px] text-zinc-600">
                产出作品（预留）
              </div>
            </section>
          </>
        ) : null}
      </div>

      {/* Edit metadata modal */}
      {editing ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="编辑技能元数据"
        >
          <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-white/10 bg-[#101724] p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100">编辑技能元数据</h3>
            {saveError ? (
              <p className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-300" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="mt-3 space-y-3 text-xs">
              <label className="block">
                <span className="mb-1 block text-zinc-400">名称</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-zinc-400">别名（逗号分隔）</span>
                <input
                  value={form.aliases}
                  onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-zinc-400">描述</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full resize-none rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-zinc-400">领域</span>
                <select
                  value={form.domainId}
                  onChange={(e) => setForm((f) => ({ ...f, domainId: e.target.value }))}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  <option value="">（未分配）</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
