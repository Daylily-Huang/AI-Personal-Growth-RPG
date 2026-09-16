"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Flag,
  Link2,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  Unlink,
} from "lucide-react";
import { BaseModal, DangerButton, PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import { SeasonStatusPill } from "@/components/journey/SeasonStatusPill";
import { journeyInputClass, journeyLabelClass } from "@/components/journey/formStyles";
import type { SeasonContext, SeasonSummary } from "@/lib/outer-loop/types";
import type { Quest } from "@/lib/store/types";

type ModalKind = "create" | "plan" | "conclude" | "cancel" | null;

interface ApiErrorPayload {
  error?: string;
  code?: string;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
  return payload.error || fallback;
}

function makeRequestKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export default function SeasonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [context, setContext] = useState<SeasonContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [planStart, setPlanStart] = useState(new Date().toISOString().slice(0, 10));
  const [planDuration, setPlanDuration] = useState("28");
  const [planCriterion, setPlanCriterion] = useState("");
  const [concludeStatus, setConcludeStatus] = useState<"COMPLETED" | "ENDED_EARLY" | "ABANDONED">("COMPLETED");
  const [reflection, setReflection] = useState("");
  const [abandonmentReason, setAbandonmentReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [linkQuestId, setLinkQuestId] = useState("");
  const [linkRole, setLinkRole] = useState<"MAIN" | "FOCUS">("FOCUS");

  const selected = useMemo(
    () => seasons.find((season) => season.id === selectedId) ?? null,
    [seasons, selectedId],
  );

  const loadContext = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/seasons/${id}`);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, "加载赛季详情失败"));
      setContext(await response.json() as SeasonContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载赛季详情失败");
    } finally {
      setDetailLoading(false);
    }
  }, [router]);

  const load = useCallback(async (preserveSelection = true) => {
    setError(null);
    try {
      const [seasonResponse, questResponse] = await Promise.all([
        fetch("/api/seasons"),
        fetch("/api/quests"),
      ]);
      if (seasonResponse.status === 401 || questResponse.status === 401) {
        router.push("/login");
        return;
      }
      if (!seasonResponse.ok) throw new Error(await readApiError(seasonResponse, "加载赛季失败"));
      if (!questResponse.ok) throw new Error("加载任务列表失败");

      const seasonPayload = await seasonResponse.json() as { seasons: SeasonSummary[] };
      const questPayload = await questResponse.json() as { quests: Quest[] };
      const nextSeasons = seasonPayload.seasons ?? [];
      setSeasons(nextSeasons);
      setQuests(questPayload.quests ?? []);

      const retained = preserveSelection && selectedId && nextSeasons.some((item) => item.id === selectedId)
        ? selectedId
        : nextSeasons.find((item) => item.status === "ACTIVE")?.id ?? nextSeasons[0]?.id ?? null;
      setSelectedId(retained);
      if (!retained) setContext(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载赛季失败");
    } finally {
      setLoading(false);
    }
  }, [router, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(timer);
  // Initial authority read only; subsequent refreshes are explicit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => {
      void loadContext(selectedId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, loadContext]);

  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 401) {
        router.push("/login");
        return false;
      }
      if (!response.ok) throw new Error(await readApiError(response, "操作失败"));
      await load();
      if (selectedId) await loadContext(selectedId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!draftName.trim()) return;
    const ok = await mutate("/api/seasons", "POST", {
      name: draftName,
      description: draftDescription || null,
    });
    if (ok) {
      setDraftName("");
      setDraftDescription("");
      setModal(null);
    }
  }

  async function planSelected(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const criterion = planCriterion.trim();
    const ok = await mutate(`/api/seasons/${selected.id}/plan`, "POST", {
      plannedStartDate: planStart,
      targetDurationDays: Number(planDuration),
      successCriteria: criterion ? [{ description: criterion }] : [],
      requestIdempotencyKey: makeRequestKey("plan"),
    });
    if (ok) setModal(null);
  }

  async function activateSelected() {
    if (!selected) return;
    await mutate(`/api/seasons/${selected.id}/activate`, "POST", {
      requestIdempotencyKey: makeRequestKey("activate"),
    });
  }

  async function cancelSelected(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const ok = await mutate(`/api/seasons/${selected.id}/cancel`, "POST", {
      cancellationReason: cancelReason || null,
      requestIdempotencyKey: makeRequestKey("cancel"),
    });
    if (ok) {
      setCancelReason("");
      setModal(null);
    }
  }

  async function concludeSelected(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const now = new Date().toISOString();
    const startedAt = context?.season.startedAt ?? now;
    const isAbandoned = concludeStatus === "ABANDONED";
    const ok = await mutate(`/api/seasons/${selected.id}/conclude`, "POST", {
      targetStatus: concludeStatus,
      finalReview: isAbandoned ? null : {
        periodStart: startedAt,
        periodEnd: now,
        objectiveSummary: {
          activities: context?.activities.length ?? 0,
          linkedQuests: context?.links.length ?? 0,
        },
        qualitativeReflection: reflection,
        criteriaEvaluation: [],
        tacticalAdjustments: null,
      },
      finalReviewCommitKey: isAbandoned ? null : crypto.randomUUID(),
      abandonmentReason: isAbandoned ? abandonmentReason : null,
      requestIdempotencyKey: makeRequestKey("conclude"),
    });
    if (ok) {
      setReflection("");
      setAbandonmentReason("");
      setModal(null);
    }
  }

  async function linkQuest(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !linkQuestId) return;
    const ok = await mutate(`/api/seasons/${selected.id}/quests`, "POST", {
      questId: linkQuestId,
      role: linkRole,
    });
    if (ok) setLinkQuestId("");
  }

  async function unlinkQuest(questId: string, role: "MAIN" | "FOCUS") {
    if (!selected) return;
    await mutate(`/api/seasons/${selected.id}/quests`, "DELETE", { questId, role });
  }

  const linkedQuestIds = new Set(context?.links.map((link) => link.questId) ?? []);
  const availableQuests = quests.filter((quest) => !linkedQuestIds.has(quest.id) && quest.status !== "archived");

  return (
    <div className="flex w-full flex-col gap-6" data-testid="journey-seasons-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-[var(--font-weight-bold)] text-[var(--text-primary)]">
            <CalendarDays className="h-6 w-6 text-[var(--text-secondary)]" aria-hidden="true" />
            赛季周期
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            用 14–84 天的有限周期组织长期成长。赛季只提供时间与复盘上下文，不直接产生 XP 或改写任务状态。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} disabled={busy}>
            刷新
          </SecondaryButton>
          <PrimaryButton onClick={() => setModal("create")} icon={<Plus className="h-4 w-4" />}>
            新建赛季
          </PrimaryButton>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-3 text-sm text-[var(--state-danger-text)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-8 text-sm text-[var(--text-muted)]">加载赛季中…</div>
      ) : seasons.length === 0 ? (
        <SectionCard title="还没有赛季" subtitle="从一个 28 天草稿开始，不需要绑定任务也可以计划和激活。">
          <div className="flex flex-col items-start gap-4 text-sm text-[var(--text-secondary)]">
            <p>赛季不会创建成长真值；Activities、XP、Skill Mastery 仍由既有 Growth Core 负责。</p>
            <PrimaryButton onClick={() => setModal("create")} icon={<Plus className="h-4 w-4" />}>创建第一个赛季</PrimaryButton>
          </div>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,2.2fr)]">
          <SectionCard title="赛季列表" subtitle={`${seasons.length} 个周期`} className="min-w-0">
            <div className="flex flex-col gap-2" aria-label="赛季列表">
              {seasons.map((season) => (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => setSelectedId(season.id)}
                  aria-pressed={selectedId === season.id}
                  className={`w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] ${
                    selectedId === season.id
                      ? "border-[var(--selection-neutral-border)] bg-[var(--selection-neutral-bg)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-ground)] hover:bg-[var(--surface-hover-neutral)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)]">{season.name}</span>
                    <SeasonStatusPill status={season.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span>{season.targetDurationDays ? `${season.targetDurationDays} 天` : "未定周期"}</span>
                    <span>{season.linkedQuestCount} 个任务</span>
                    <span>{season.reviewCount} 次复盘</span>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="min-w-0 space-y-5">
            {!selected || detailLoading || !context ? (
              <SectionCard title="赛季详情">
                <p className="text-sm text-[var(--text-muted)]">{detailLoading ? "加载详情中…" : "选择一个赛季查看详情。"}</p>
              </SectionCard>
            ) : (
              <>
                <SectionCard
                  title={selected.name}
                  subtitle={selected.description || "未填写赛季说明"}
                  action={<SeasonStatusPill status={selected.status} />}
                  footer={
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span>开始：{formatDate(selected.startedAt || selected.plannedStartDate)}</span>
                      <span>结束：{formatDate(selected.endedAt)}</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      ["目标周期", selected.targetDurationDays ? `${selected.targetDurationDays} 天` : "未计划"],
                      ["关联任务", `${context.links.length}`],
                      ["派生活动", `${context.activities.length}`],
                      ["复盘版本", `${context.reviews.length}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] p-3">
                        <div className="text-xs text-[var(--text-muted)]">{label}</div>
                        <div className="mt-1 text-lg font-[var(--font-weight-semibold)] text-[var(--text-primary)]">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.status === "DRAFT" ? (
                      <PrimaryButton onClick={() => setModal("plan")} icon={<Flag className="h-4 w-4" />}>计划赛季</PrimaryButton>
                    ) : null}
                    {selected.status === "PLANNED" ? (
                      <PrimaryButton onClick={() => void activateSelected()} loading={busy} icon={<Rocket className="h-4 w-4" />}>激活赛季</PrimaryButton>
                    ) : null}
                    {selected.status === "DRAFT" || selected.status === "PLANNED" ? (
                      <DangerButton onClick={() => setModal("cancel")} icon={<Trash2 className="h-4 w-4" />}>取消赛季</DangerButton>
                    ) : null}
                    {selected.status === "ACTIVE" ? (
                      <PrimaryButton onClick={() => setModal("conclude")} icon={<CheckCircle2 className="h-4 w-4" />}>结束赛季</PrimaryButton>
                    ) : null}
                    <Link
                      href={`/journey/reviews?seasonId=${selected.id}`}
                      className="inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2 text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                    >
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                      查看复盘
                    </Link>
                  </div>
                </SectionCard>

                <SectionCard title="赛季任务关系" subtitle="0..1 MAIN，0..N FOCUS；不会改写 Quest 生命周期。" icon={<Link2 className="h-4 w-4" />}>
                  {selected.status === "DRAFT" || selected.status === "PLANNED" || selected.status === "ACTIVE" ? (
                    <form onSubmit={linkQuest} className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_9rem_auto]">
                      <select value={linkQuestId} onChange={(e) => setLinkQuestId(e.target.value)} className={journeyInputClass} aria-label="选择要关联的任务">
                        <option value="">选择任务</option>
                        {availableQuests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
                      </select>
                      <select value={linkRole} onChange={(e) => setLinkRole(e.target.value as "MAIN" | "FOCUS")} className={journeyInputClass} aria-label="任务在赛季中的角色">
                        <option value="FOCUS">FOCUS</option>
                        <option value="MAIN">MAIN</option>
                      </select>
                      <SecondaryButton type="submit" disabled={!linkQuestId || busy} icon={<Link2 className="h-4 w-4" />}>关联</SecondaryButton>
                    </form>
                  ) : null}

                  <div className="space-y-2">
                    {context.links.length === 0 ? <p className="text-sm text-[var(--text-muted)]">当前没有关联任务。</p> : context.links.map((link) => {
                      const quest = quests.find((item) => item.id === link.questId);
                      return (
                        <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-2.5">
                          <div>
                            <div className="text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">{quest?.title || link.questId}</div>
                            <div className="text-xs text-[var(--text-muted)]">{link.role}</div>
                          </div>
                          {selected.status === "DRAFT" || selected.status === "PLANNED" || selected.status === "ACTIVE" ? (
                            <button type="button" onClick={() => void unlinkQuest(link.questId, link.role)} className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]" aria-label={`取消关联 ${quest?.title || link.questId}`}>
                              <Unlink className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="派生赛季活动" subtitle="只读取已关联 Quest 在赛季时间窗内的 Activities，不修改 Activity schema。" icon={<Activity className="h-4 w-4" />}>
                  <div className="space-y-2">
                    {context.activities.length === 0 ? <p className="text-sm text-[var(--text-muted)]">当前没有可归入此赛季上下文的活动。</p> : context.activities.map((activity) => (
                      <div key={activity.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-2.5">
                        <div className="text-sm text-[var(--text-primary)]">{activity.title}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(activity.createdAt)} · {activity.activityType || "activity"}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        </div>
      )}

      <BaseModal open={modal === "create"} onClose={() => setModal(null)} title="新建赛季草稿" description="先记录主题，再通过确定性流程计划与激活。">
        <form onSubmit={createDraft} className="space-y-4">
          <label className={journeyLabelClass}>赛季名称<input className={journeyInputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} required maxLength={120} /></label>
          <label className={journeyLabelClass}>说明<textarea className={`${journeyInputClass} min-h-24 resize-y`} value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><SecondaryButton onClick={() => setModal(null)}>返回</SecondaryButton><PrimaryButton type="submit" loading={busy}>创建草稿</PrimaryButton></div>
        </form>
      </BaseModal>

      <BaseModal open={modal === "plan"} onClose={() => setModal(null)} title="计划赛季" description="周期必须在 14–84 天之间。">
        <form onSubmit={planSelected} className="space-y-4">
          <label className={journeyLabelClass}>计划开始日期<input type="date" className={journeyInputClass} value={planStart} onChange={(e) => setPlanStart(e.target.value)} required /></label>
          <label className={journeyLabelClass}>目标周期（天）<input type="number" min={14} max={84} className={journeyInputClass} value={planDuration} onChange={(e) => setPlanDuration(e.target.value)} required /></label>
          <label className={journeyLabelClass}>首要成功标准<textarea className={`${journeyInputClass} min-h-24 resize-y`} value={planCriterion} onChange={(e) => setPlanCriterion(e.target.value)} placeholder="例如：完成论文方法章节并形成可复现分析脚本" /></label>
          <div className="flex justify-end gap-2"><SecondaryButton onClick={() => setModal(null)}>返回</SecondaryButton><PrimaryButton type="submit" loading={busy}>提交计划</PrimaryButton></div>
        </form>
      </BaseModal>

      <BaseModal open={modal === "cancel"} onClose={() => setModal(null)} title="取消未激活赛季" description="只允许取消 DRAFT / PLANNED；已经 ACTIVE 的历史不能用此操作删除。">
        <form onSubmit={cancelSelected} className="space-y-4">
          <label className={journeyLabelClass}>取消原因（可选）<textarea className={`${journeyInputClass} min-h-20 resize-y`} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><SecondaryButton onClick={() => setModal(null)}>返回</SecondaryButton><DangerButton type="submit" loading={busy}>确认取消</DangerButton></div>
        </form>
      </BaseModal>

      <BaseModal open={modal === "conclude"} onClose={() => setModal(null)} title="结束当前赛季" description="COMPLETED / ENDED_EARLY 会原子提交 FINAL Review；ABANDONED 不创建 FINAL Review。">
        <form onSubmit={concludeSelected} className="space-y-4">
          <label className={journeyLabelClass}>终局状态<select className={journeyInputClass} value={concludeStatus} onChange={(e) => setConcludeStatus(e.target.value as typeof concludeStatus)}><option value="COMPLETED">COMPLETED</option><option value="ENDED_EARLY">ENDED_EARLY</option><option value="ABANDONED">ABANDONED</option></select></label>
          {concludeStatus === "ABANDONED" ? (
            <label className={journeyLabelClass}>放弃原因<textarea required className={`${journeyInputClass} min-h-24 resize-y`} value={abandonmentReason} onChange={(e) => setAbandonmentReason(e.target.value)} /></label>
          ) : (
            <label className={journeyLabelClass}>最终复盘反思<textarea required className={`${journeyInputClass} min-h-32 resize-y`} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="本周期做成了什么、哪里失效、下一周期要调整什么？" /></label>
          )}
          <div className="flex justify-end gap-2"><SecondaryButton onClick={() => setModal(null)}>返回</SecondaryButton><PrimaryButton type="submit" loading={busy}>原子提交终局</PrimaryButton></div>
        </form>
      </BaseModal>
    </div>
  );
}
