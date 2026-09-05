"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Pencil,
  X,
  XCircle,
} from "lucide-react";
import type {
  Domain,
  SkillDetailResponse,
  SkillDerivedState,
} from "@/lib/store/types";
import { BaseModal } from "@/components/ui/BaseModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { XPProgress } from "@/components/ui/XPProgress";
import EvidenceTimeline from "./EvidenceTimeline";
import { buildMetadataPatch, nextArchiveStatus, type SkillMetadataPatch } from "./controller";
import { formatConfidence, formatTimestamp, getSkillStateVisual } from "./presentation";

const MASTERY_LADDER = Array.from({ length: 11 }, (_, i) => i);

function MasteryHistoryEventType({ eventType }: { eventType: string }) {
  const label =
    eventType === "upgrade"
      ? "升级"
      : eventType === "request_verification"
        ? "待验证"
        : eventType;
  return <span className="font-medium text-[var(--text-primary)]">{label}</span>;
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

  async function patchSkill(body: SkillMetadataPatch | Record<string, unknown>): Promise<boolean> {
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
    const result = buildMetadataPatch({
      name: form.name,
      aliasesRaw: form.aliases,
      description: form.description,
      domainId: form.domainId,
    });
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    const ok = await patchSkill(result.patch);
    if (ok) setEditing(false);
  }

  async function toggleArchive() {
    if (!detail) return;
    await patchSkill({ status: nextArchiveStatus(detail.skill.derivedState) });
  }

  const stateVisual: ReturnType<typeof getSkillStateVisual> | null = detail
    ? getSkillStateVisual(detail.skill.derivedState as SkillDerivedState)
    : null;

  return (
    <div className="flex h-full flex-col" aria-label="技能详情面板">
      {/* Panel header */}
      <div className="border-b border-[var(--border-subtle)] px-4 py-3 bg-[var(--surface-base)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {loading || !detail ? (
              <div className="h-6 w-36 animate-pulse motion-reduce:animate-none rounded-[var(--radius-sm)] bg-[var(--surface-ground)]" />
            ) : (
              <h2 className="truncate text-base font-semibold text-[var(--text-primary)]" title={detail.skill.name}>
                {detail.skill.name}
              </h2>
            )}
            {!loading && detail ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {detail.skill.domainName ? (
                  <span className="rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    {detail.skill.domainName}
                  </span>
                ) : null}
                {detail.skill.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
                  >
                    {alias}
                  </span>
                ))}
                {stateVisual ? (
                  <span
                    className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] ${stateVisual.badgeClass}`}
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
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
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
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] disabled:opacity-50"
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
              className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3" role="status" aria-busy="true" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse motion-reduce:animate-none rounded-[var(--radius-md)] bg-[var(--surface-ground)]" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            <p className="text-sm text-[var(--state-danger-text)]">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            >
              重试
            </button>
          </div>
        ) : detail ? (
          <>
            {/* Description (Stage 5B field; null → explicit empty state) */}
            <section aria-label="技能描述">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                描述
              </h3>
              {detail.skill.description ? (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
                  {detail.skill.description}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-disabled)]">暂无描述。</p>
              )}
            </section>

            {/* Progression */}
            <section aria-label="等级与掌握进度" className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">Lv.{detail.skill.level}</span>
                  <span>
                    {detail.skill.xp} / {detail.skill.nextLevelXp} XP
                  </span>
                </div>
                <div className="mt-1">
                  <XPProgress
                    current={detail.skill.xp}
                    max={detail.skill.nextLevelXp}
                    showReadout={false}
                    size="sm"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-[var(--text-secondary)]">掌握阶梯</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {MASTERY_LADDER.map((m) => (
                    <span
                      key={m}
                      className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[10px] ${
                        m === detail.skill.masteryLevel
                          ? "bg-[var(--surface-hover-neutral)] font-bold text-[var(--text-primary)] border border-[var(--border-hover-neutral)]"
                          : m < detail.skill.masteryLevel
                            ? "bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                            : "bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-[var(--text-disabled)]"
                      }`}
                    >
                      M{m}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span
                    title="置信度反映系统对该掌握等级的确定程度；≥50% 视为证据稳固"
                    className="cursor-help underline decoration-dotted decoration-[var(--border-raised)] underline-offset-2"
                  >
                    掌握置信度
                  </span>
                  <span>{formatConfidence(detail.skill.masteryConfidence)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-ground)] border border-[var(--border-subtle)]">
                  <div
                    className="h-full rounded-full bg-[var(--state-info-text)] transition-all duration-[var(--duration-normal)]"
                    style={{ width: `${Math.round(detail.skill.masteryConfidence * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-0.5 text-[11px] text-[var(--text-muted)]">
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
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                前置技能（M≥2 且置信≥50% 视为满足）
              </h3>
              {detail.prerequisites.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">无前置技能。</p>
              ) : (
                <ul className="space-y-1">
                  {detail.prerequisites.map((prereq) => (
                    <li key={prereq.id}>
                      <button
                        type="button"
                        onClick={() => onFocusSkill(prereq.id)}
                        className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1.5 text-left text-xs transition-colors hover:border-[var(--border-hover-neutral)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
                      >
                        {prereq.isFulfilled ? (
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--state-success-text)]" />
                        ) : (
                          <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--state-danger-text)]" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{prereq.name}</span>
                        <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                          M{prereq.masteryLevel} · {formatConfidence(prereq.masteryConfidence)}
                        </span>
                        <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Next unlocks */}
            <section aria-label="下一步解锁">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                下一步可解锁
              </h3>
              {detail.nextUnlocks.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">暂无依赖此技能的后续解锁。</p>
              ) : (
                <ul className="grid grid-cols-1 gap-1.5">
                  {detail.nextUnlocks.map((unlock) => {
                    const uv = getSkillStateVisual(unlock.derivedState as SkillDerivedState);
                    return (
                      <li key={unlock.id}>
                        <button
                          type="button"
                          onClick={() => onFocusSkill(unlock.id)}
                          className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left text-xs transition-colors hover:border-[var(--border-hover-neutral)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
                        >
                          <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{unlock.name}</span>
                          <span className={`shrink-0 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] ${uv.badgeClass}`}>
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
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                证据与审计
              </h3>
              <EvidenceTimeline items={detail.evidenceTimeline} />
            </section>

            {/* Mastery history */}
            <section aria-label="掌握历史">
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                掌握变更历史
              </h3>
              {detail.masteryHistory.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">暂无掌握等级变更记录。</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.masteryHistory.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--state-info-text)]" />
                        <MasteryHistoryEventType eventType={event.eventType} />
                        <span className="font-mono text-[var(--text-secondary)]">
                          M{event.fromLevel}→M{event.toLevel}
                        </span>
                        <span
                          className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--state-info-bg)] border border-[var(--state-info-border)] px-1 py-0.5 font-mono text-[10px] text-[var(--state-info-text)]"
                          title="变更时的掌握置信度快照"
                        >
                          置信 {formatConfidence(event.confidence)}
                        </span>
                        <span className="ml-auto shrink-0 text-[var(--text-muted)]">
                          <time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time>
                        </span>
                      </div>
                      {event.reason ? (
                        <p
                          className="mt-1 line-clamp-2 pl-[22px] leading-relaxed text-[var(--text-secondary)]"
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
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                近期 XP 记录
              </h3>
              {detail.recentTransactions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">暂无经验记录。</p>
              ) : (
                <ul className="space-y-1">
                  {detail.recentTransactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 text-[11px] hover:bg-[var(--surface-hover-neutral)]"
                    >
                      <span className="w-14 shrink-0 font-mono text-[var(--text-primary)] font-semibold">
                        +{tx.amount} XP
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]" title={tx.reason}>
                        {tx.reason}
                      </span>
                      <time dateTime={tx.createdAt} className="shrink-0 text-[var(--text-muted)]">
                        {formatTimestamp(tx.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Future hooks — reserved containers, intentionally inert */}
            <section aria-label="预留区块" className="grid grid-cols-2 gap-2 pb-2">
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-ground)] p-2.5 text-center text-[10px] text-[var(--text-disabled)]">
                相关任务（预留）
              </div>
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-ground)] p-2.5 text-center text-[10px] text-[var(--text-disabled)]">
                产出作品（预留）
              </div>
            </section>
          </>
        ) : null}
      </div>

      {/* Edit metadata modal via BaseModal */}
      <BaseModal
        open={editing}
        onClose={() => setEditing(false)}
        title="编辑技能元数据"
        ariaLabel="编辑技能元数据"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setEditing(false)} disabled={saving}>
              取消
            </SecondaryButton>
            <PrimaryButton onClick={handleSave} loading={saving}>
              保存
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {saveError ? (
            <p className="rounded-[var(--radius-sm)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] px-2 py-1 text-xs text-[var(--state-danger-text)]" role="alert">
              {saveError}
            </p>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[var(--text-secondary)]">名称</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-2 py-1.5 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--text-secondary)]">别名（逗号分隔）</span>
            <input
              value={form.aliases}
              onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-2 py-1.5 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--text-secondary)]">描述</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-2 py-1.5 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--text-secondary)]">领域</span>
            <select
              value={form.domainId}
              onChange={(e) => setForm((f) => ({ ...f, domainId: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-2 py-1.5 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
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
      </BaseModal>
    </div>
  );
}
