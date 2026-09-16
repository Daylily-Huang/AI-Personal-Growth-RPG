"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardCheck,
  Edit3,
  FileClock,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { BaseModal, PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import { SeasonStatusPill } from "@/components/journey/SeasonStatusPill";
import { journeyInputClass, journeyLabelClass } from "@/components/journey/formStyles";
import type { SeasonReview, SeasonSummary } from "@/lib/outer-loop/types";

interface ApiErrorPayload {
  error?: string;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
  return payload.error || fallback;
}

function toDatetimeLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string): string {
  return new Date(value).toISOString();
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface ReviewsClientProps {
  initialSeasonId?: string | null;
}

export default function ReviewsClient({ initialSeasonId = null }: ReviewsClientProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState<SeasonReview[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState(initialSeasonId ?? "all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [amendingReview, setAmendingReview] = useState<SeasonReview | null>(null);

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [reviewType, setReviewType] = useState<"WEEKLY" | "AD_HOC">("WEEKLY");
  const [editorSeasonId, setEditorSeasonId] = useState(initialSeasonId ?? "");
  const [periodStart, setPeriodStart] = useState(toDatetimeLocal(oneWeekAgo.toISOString()));
  const [periodEnd, setPeriodEnd] = useState(toDatetimeLocal(now.toISOString()));
  const [reflection, setReflection] = useState("");
  const [adjustments, setAdjustments] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [reviewResponse, seasonResponse] = await Promise.all([
        fetch("/api/reviews"),
        fetch("/api/seasons"),
      ]);
      if (reviewResponse.status === 401 || seasonResponse.status === 401) {
        router.push("/login");
        return;
      }
      if (!reviewResponse.ok) throw new Error(await readApiError(reviewResponse, "加载复盘失败"));
      if (!seasonResponse.ok) throw new Error(await readApiError(seasonResponse, "加载赛季失败"));
      const reviewPayload = await reviewResponse.json() as { reviews: SeasonReview[] };
      const seasonPayload = await seasonResponse.json() as { seasons: SeasonSummary[] };
      setReviews(reviewPayload.reviews ?? []);
      setSeasons(seasonPayload.seasons ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载复盘失败");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredReviews = useMemo(
    () => selectedSeasonId === "all"
      ? reviews
      : reviews.filter((review) => review.seasonId === selectedSeasonId),
    [reviews, selectedSeasonId],
  );

  const activeSeasons = seasons.filter((season) => season.status === "ACTIVE");
  const latestFinalBySeason = useMemo(() => {
    const latest = new Map<string, SeasonReview>();
    for (const review of reviews) {
      if (review.reviewType !== "FINAL" || review.supersededById !== null) continue;
      latest.set(review.seasonId, review);
    }
    return latest;
  }, [reviews]);

  async function submitPeriodicReview(event: React.FormEvent) {
    event.preventDefault();
    if (!editorSeasonId || !reflection.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/seasons/${editorSeasonId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewType,
          periodStart: toIso(periodStart),
          periodEnd: toIso(periodEnd),
          objectiveSummary: {},
          qualitativeReflection: reflection,
          criteriaEvaluation: [],
          tacticalAdjustments: adjustments || null,
          commitKey: crypto.randomUUID(),
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, "提交复盘失败"));
      setEditorOpen(false);
      setReflection("");
      setAdjustments("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交复盘失败");
    } finally {
      setBusy(false);
    }
  }

  function openAmendment(review: SeasonReview) {
    setAmendingReview(review);
    setReflection(review.qualitativeReflection);
    setAdjustments(review.tacticalAdjustments ?? "");
    setPeriodStart(toDatetimeLocal(review.periodStart));
    setPeriodEnd(toDatetimeLocal(review.periodEnd));
    setAmendmentReason("");
  }

  async function submitAmendment(event: React.FormEvent) {
    event.preventDefault();
    if (!amendingReview || !reflection.trim() || !amendmentReason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/seasons/${amendingReview.seasonId}/reviews/final`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: {
            periodStart: toIso(periodStart),
            periodEnd: toIso(periodEnd),
            objectiveSummary: amendingReview.objectiveSummary,
            qualitativeReflection: reflection,
            criteriaEvaluation: amendingReview.criteriaEvaluation,
            tacticalAdjustments: adjustments || null,
          },
          amendmentReason,
          commitKey: crypto.randomUUID(),
          requestIdempotencyKey: `amend-${crypto.randomUUID()}`,
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, "修订 FINAL Review 失败"));
      setAmendingReview(null);
      setReflection("");
      setAdjustments("");
      setAmendmentReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "修订 FINAL Review 失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6" data-testid="journey-reviews-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-[var(--font-weight-bold)] text-[var(--text-primary)]">
            <ClipboardCheck className="h-6 w-6 text-[var(--text-secondary)]" aria-hidden="true" />
            结构化复盘
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Review 是用户确认的版本化综合记录。它可以总结 Growth Core 真值，但不能创建 XP、Mastery 或 Evidence。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => void load()} disabled={busy} icon={<RefreshCw className="h-4 w-4" />}>刷新</SecondaryButton>
          <PrimaryButton
            onClick={() => {
              setAmendingReview(null);
              if (!editorSeasonId) setEditorSeasonId(activeSeasons[0]?.id ?? "");
              setEditorOpen(true);
            }}
            disabled={activeSeasons.length === 0}
            icon={<Plus className="h-4 w-4" />}
          >
            新建周期复盘
          </PrimaryButton>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
          <div className="text-xs text-[var(--text-muted)]">全部版本</div>
          <div className="mt-1 text-2xl font-[var(--font-weight-semibold)] text-[var(--text-primary)]">{reviews.length}</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
          <div className="text-xs text-[var(--text-muted)]">当前有效版本</div>
          <div className="mt-1 text-2xl font-[var(--font-weight-semibold)] text-[var(--text-primary)]">{reviews.filter((review) => review.supersededById === null).length}</div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
          <div className="text-xs text-[var(--text-muted)]">可做周期复盘的 ACTIVE Season</div>
          <div className="mt-1 text-2xl font-[var(--font-weight-semibold)] text-[var(--text-primary)]">{activeSeasons.length}</div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-3 text-sm text-[var(--state-danger-text)]">
          {error}
        </div>
      ) : null}

      <SectionCard
        title="复盘档案"
        subtitle="历史版本保留；superseded 只建立单向版本指针。"
        icon={<FileClock className="h-4 w-4" />}
        action={
          <select
            aria-label="按赛季筛选复盘"
            className={`${journeyInputClass} min-w-40`}
            value={selectedSeasonId}
            onChange={(event) => setSelectedSeasonId(event.target.value)}
          >
            <option value="all">全部赛季</option>
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
          </select>
        }
      >
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">加载复盘中…</p>
        ) : filteredReviews.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-4 text-sm text-[var(--text-secondary)]">
            <p>当前筛选范围没有复盘记录。</p>
            {activeSeasons.length > 0 ? <p className="text-xs text-[var(--text-muted)]">可以为 ACTIVE Season 创建 WEEKLY 或 AD_HOC Review。</p> : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredReviews.map((review) => {
              const season = seasons.find((item) => item.id === review.seasonId);
              const current = review.supersededById === null;
              const latestFinal = latestFinalBySeason.get(review.seasonId)?.id === review.id;
              const amendable = review.reviewType === "FINAL" && latestFinal && season && (season.status === "COMPLETED" || season.status === "ENDED_EARLY");
              return (
                <article key={review.id} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)]">{review.reviewType} · v{review.version}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${current ? "border-[var(--authority-verified-border)] bg-[var(--authority-verified-bg)] text-[var(--authority-verified-text)]" : "border-[var(--status-superseded-border)] bg-[var(--status-superseded-bg)] text-[var(--status-superseded-text)]"}`}>
                          {current ? "当前版本" : "已更替"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{season?.name || review.seasonId}</div>
                    </div>
                    {season ? <SeasonStatusPill status={season.status} /> : null}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDateTime(review.periodStart)} → {formatDateTime(review.periodEnd)}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{review.qualitativeReflection}</p>
                  {review.tacticalAdjustments ? (
                    <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      <span className="font-[var(--font-weight-semibold)] text-[var(--text-primary)]">战术调整：</span> {review.tacticalAdjustments}
                    </div>
                  ) : null}
                  {review.amendmentReason ? <div className="mt-2 text-xs text-[var(--text-muted)]">修订原因：{review.amendmentReason}</div> : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                    <div className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      immutable commit · {review.commitKey.slice(0, 8)}…
                    </div>
                    {amendable ? (
                      <SecondaryButton size="sm" onClick={() => openAmendment(review)} icon={<Edit3 className="h-3.5 w-3.5" />}>修订 FINAL</SecondaryButton>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-secondary)]">
        <div className="font-[var(--font-weight-semibold)] text-[var(--text-primary)]">FINAL Review 的权威边界</div>
        <p className="mt-1">首次 FINAL Review 只能与 COMPLETED / ENDED_EARLY 的 Season conclusion 原子提交。这里不会提供“单独新建 FINAL”的按钮。</p>
        <Link href="/journey/seasons" className="mt-2 inline-flex text-[var(--text-primary)] underline decoration-[var(--border-default)] underline-offset-4 hover:decoration-current">返回赛季页执行结季</Link>
      </div>

      <BaseModal open={editorOpen} onClose={() => setEditorOpen(false)} title="新建周期复盘" description="仅 WEEKLY / AD_HOC；提交后形成不可变版本。">
        <form onSubmit={submitPeriodicReview} className="space-y-4">
          <label className={journeyLabelClass}>ACTIVE Season<select className={journeyInputClass} value={editorSeasonId} onChange={(e) => setEditorSeasonId(e.target.value)} required><option value="">选择赛季</option>{activeSeasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
          <label className={journeyLabelClass}>复盘类型<select className={journeyInputClass} value={reviewType} onChange={(e) => setReviewType(e.target.value as typeof reviewType)}><option value="WEEKLY">WEEKLY</option><option value="AD_HOC">AD_HOC</option></select></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={journeyLabelClass}>周期开始<input type="datetime-local" className={journeyInputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required /></label>
            <label className={journeyLabelClass}>周期结束<input type="datetime-local" className={journeyInputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required /></label>
          </div>
          <label className={journeyLabelClass}>定性反思<textarea className={`${journeyInputClass} min-h-32 resize-y`} value={reflection} onChange={(e) => setReflection(e.target.value)} required placeholder="发生了什么？哪些模式值得保留或修正？" /></label>
          <label className={journeyLabelClass}>战术调整（可选）<textarea className={`${journeyInputClass} min-h-24 resize-y`} value={adjustments} onChange={(e) => setAdjustments(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><SecondaryButton onClick={() => setEditorOpen(false)}>返回</SecondaryButton><PrimaryButton type="submit" loading={busy}>确认并固化</PrimaryButton></div>
        </form>
      </BaseModal>

      <BaseModal open={Boolean(amendingReview)} onClose={() => setAmendingReview(null)} title="修订 FINAL Review" description="将创建 vN+1，新版本 supersede 当前 FINAL；Season 终局状态保持不变。">
        <form onSubmit={submitAmendment} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={journeyLabelClass}>周期开始<input type="datetime-local" className={journeyInputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required /></label>
            <label className={journeyLabelClass}>周期结束<input type="datetime-local" className={journeyInputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required /></label>
          </div>
          <label className={journeyLabelClass}>修订后的反思<textarea className={`${journeyInputClass} min-h-32 resize-y`} value={reflection} onChange={(e) => setReflection(e.target.value)} required /></label>
          <label className={journeyLabelClass}>战术调整（可选）<textarea className={`${journeyInputClass} min-h-24 resize-y`} value={adjustments} onChange={(e) => setAdjustments(e.target.value)} /></label>
          <label className={journeyLabelClass}>修订原因<textarea className={`${journeyInputClass} min-h-20 resize-y`} value={amendmentReason} onChange={(e) => setAmendmentReason(e.target.value)} required /></label>
          <div className="flex justify-end gap-2"><SecondaryButton onClick={() => setAmendingReview(null)}>返回</SecondaryButton><PrimaryButton type="submit" loading={busy}>创建新 FINAL 版本</PrimaryButton></div>
        </form>
      </BaseModal>
    </div>
  );
}
