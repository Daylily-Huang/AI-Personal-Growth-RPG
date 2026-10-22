"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TaskFirstGuide } from "@/components/dashboard/TaskFirstGuide";
import SettlementFeedback, { GrowthStage, GrowthRipple, settlementReceipt, type SettlementReceipt } from "@/components/dashboard/SettlementFeedback";
import effects from "@/components/dashboard/SettlementFeedback.module.css";
import { useRouter } from "next/navigation";
import type {
  Activity,
  DashboardSnapshot,
} from "@/lib/store/types";
import { useOptionalAppShell } from "@/components/layout/AppShellContext";
import type { ArtifactResolutionInput } from "@/types/artifact";

import {
  DashboardHeader,
  PlayerHeroCard,
  QuestsOverview,
  QuickLogCard,
  TopSkillsCard,
  PendingProposals,
  PendingVerifications,
  RecentGrowthFeed,
  ActivityHistoryList,
  OverviewSummaryCards,
  LoadingState,
  ErrorState,
  EmptyState,
  isFreshDashboard,
} from "@/components/dashboard";

export default function DashboardPage() {
  const router = useRouter();
  const shellCtx = useOptionalAppShell();

  const [localDashboard, setLocalDashboard] = useState<DashboardSnapshot | null>(null);
  const [localLoading, setLocalLoading] = useState<boolean>(!shellCtx?.dashboard);
  const [localError, setLocalError] = useState<string | null>(null);

  const dashboard = shellCtx ? shellCtx.dashboard : localDashboard;
  const loading = shellCtx ? shellCtx.dashboardLoading : localLoading;
  const error = (shellCtx ? shellCtx.dashboardError : null) || localError;

  const [rawInput, setRawInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [growthReceipt, setGrowthReceipt] = useState<SettlementReceipt | null>(null);
  const shownReceipts = useRef(new Set<string>());
  const [presentedReceipts, setPresentedReceipts] = useState<Set<string>>(() => new Set());
  const notePresented = useCallback((id: string) => setPresentedReceipts(previous => previous.has(id) ? previous : new Set([...previous, id])), []);

  const load = useCallback(async () => {
    setLocalError(null);
    if (shellCtx) {
      const res = await shellCtx.refreshDashboard();
      if (res.status === 401) {
        router.push("/login");
      }
      return;
    }

    // Standalone fallback
    try {
      setLocalLoading(true);
      const res = await fetch("/api/dashboard");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data = await res.json();
      setLocalDashboard(data.dashboard);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLocalLoading(false);
    }
  }, [router, shellCtx]);

  // Handle initial 401 unauthenticated redirect from AppShellProvider
  useEffect(() => {
    if (shellCtx?.dashboardError === "unauthenticated") {
      router.push("/login");
    }
  }, [shellCtx?.dashboardError, router]);

  // Only run independent mount fetch if NOT inside AppShellProvider
  useEffect(() => {
    if (shellCtx) {
      return;
    }

    let ignore = false;
    async function fetchDashboard() {
      try {
        setLocalLoading(true);
        const res = await fetch("/api/dashboard");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load dashboard");
        const data = await res.json();
        if (!ignore) setLocalDashboard(data.dashboard);
      } catch (e) {
        if (!ignore) setLocalError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!ignore) setLocalLoading(false);
      }
    }

    void fetchDashboard();
    return () => {
      ignore = true;
    };
  }, [router, shellCtx]);

  async function handleQuickLog(e: React.FormEvent) {
    e.preventDefault();
    const text = rawInput.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setLocalError(null);
    try {
      const createRes = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: text }),
      });
      if (createRes.status === 401) {
        router.push("/login");
        return;
      }
      if (!createRes.ok) throw new Error("Failed to save activity");
      const { activity } = (await createRes.json()) as { activity: Activity };

      const assessRes = await fetch(`/api/activities/${activity.id}/assess`, { method: "POST" });
      if (assessRes.status === 401) {
        router.push("/login");
        return;
      }
      if (!assessRes.ok) throw new Error("AI assessment failed, but your activity is saved");
      setRawInput("");
      setLocalLoading(true);
      await load();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(
    assessmentId: string,
    resolutions?: ArtifactResolutionInput[]
  ) {
    setConfirmingId(assessmentId);
    setLocalError(null);
    try {
      const payload =
        resolutions && resolutions.length > 0
          ? { artifactResolutions: resolutions }
          : {};

      const res = await fetch(`/api/assessments/${assessmentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409 && errData.code === "artifact_title_conflict") {
          throw new Error("结算失败：新建造物标题与已有造物冲突，请在提案中修改标题");
        }
        if (res.status === 409 && errData.code === "already_confirmed") {
          throw new Error("该评估已完成结算，请刷新页面");
        }
        if (res.status === 404) {
          throw new Error("该造物不存在或当前账户无权访问。");
        }
        if (res.status === 400) {
          throw new Error(errData.error || "造物提案解析参数不完整或存在索引错误");
        }
        throw new Error(errData.error || "Failed to confirm assessment");
      }

      const receipt = settlementReceipt(await res.json().catch(() => null), assessmentId);
      if (receipt && !shownReceipts.current.has(receipt.id)) {
        shownReceipts.current.add(receipt.id);
        setGrowthReceipt({ ...receipt, previousPlayerLevel: dashboard?.player.playerLevel });
      }
      setLocalLoading(true);
      await load();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setConfirmingId(null);
    }
  }

  const focusQuickLog = () => {
    const input = document.getElementById("quick-log-input") as HTMLInputElement | null;
    if (input) {
      input.scrollIntoView({ behavior: "auto", block: "center" });
      input.focus();
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="min-w-0 max-w-full overflow-x-clip">
        <LoadingState />
      </div>
    );
  }

  if (error && !dashboard) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!dashboard) {
    return <EmptyState onFocusQuickLog={focusQuickLog} />;
  }

  const fresh = isFreshDashboard(dashboard);
  const focusReview = () => {
    const section = document.getElementById("growth-review-step");
    section?.scrollIntoView({ behavior: "auto", block: "start" });
    section?.focus();
  };

  return (
    <GrowthStage className="relative flex w-full flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* 顶部问候栏 (h2, 真实无假姓名) */}
      <DashboardHeader onQuickLog={focusQuickLog} />
      {growthReceipt ? <SettlementFeedback key={growthReceipt.id} receipt={growthReceipt} currentPlayerLevel={dashboard.recentGrowth.some(t => t.id === growthReceipt.id) ? dashboard.player.playerLevel : undefined} animateArrival={!presentedReceipts.has(growthReceipt.id)} onPresented={notePresented} onDismiss={() => setGrowthReceipt(null)} /> : null}

      {/* Non-blocking Error Toast/Alert */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-3 text-sm text-[var(--state-danger-text)] shadow-xs"
        >
          {error}
        </div>
      ) : null}

      <TaskFirstGuide dashboard={dashboard} onQuickLog={focusQuickLog} onReview={focusReview} />

      {/* The action guide is also available to returning users. */}
      {fresh && <EmptyState onFocusQuickLog={focusQuickLog} />}

      {/* LEVEL 1 & 2: Player Identity & Current Action Quests */}
      <div
        data-testid="dashboard-core-grid"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
      >
        <div className={`order-2 lg:order-1 lg:col-span-5 ${effects.heroFrame}`}>
          {growthReceipt && growthReceipt.amount > 0 ? <GrowthRipple key={growthReceipt.id} /> : null}
          <PlayerHeroCard dashboard={dashboard} />
        </div>
        <div className="order-1 lg:order-2 lg:col-span-7">
          <QuestsOverview
            mainQuest={dashboard.mainQuest}
            activeQuests={dashboard.activeQuests}
          />
        </div>
      </div>

      {/* LEVEL 2: Quick Activity Logging */}
      <div data-testid="dashboard-action-grid">
        <QuickLogCard
          rawInput={rawInput}
          setRawInput={setRawInput}
          onSubmit={handleQuickLog}
          submitting={submitting}
        />
      </div>

      {/* A stable destination exists even when there are no pending proposals. */}
      <section id="growth-review-step" tabIndex={-1} aria-labelledby="growth-review-title" className="scroll-mt-24 space-y-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]">
        <div>
          <h2 id="growth-review-title" className="font-serif text-lg font-semibold text-[var(--text-primary)]">下一步：核对成长建议</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{dashboard.pendingAssessments.length ? "先核对事实和证据，确认准确后再结算；也可以修改或拒绝。" : "目前没有待核对的成长建议。完成一次实际行动后，先在上方记录结果。"}</p>
        </div>
        <PendingProposals
          assessments={dashboard.pendingAssessments}
          confirmingId={confirmingId}
          onConfirm={handleConfirm}
        />
      </section>

      {/* Pending Mastery Verifications */}
      <PendingVerifications verifications={dashboard.pendingMasteryVerifications} />

      {/* Core Real Skills Overview */}
      <TopSkillsCard skills={dashboard.skills} />

      {/* LEVEL 3: Growth Signals (Recent Growth Feed & Activity History) */}
      <div
        data-testid="dashboard-growth-grid"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        <div className="lg:col-span-6">
          <RecentGrowthFeed transactions={dashboard.recentGrowth} />
        </div>
        <div className="lg:col-span-6">
          <ActivityHistoryList activities={dashboard.activities} />
        </div>
      </div>

      {/* LEVEL 4: Knowledge / Artifacts / Skills Overview Signals */}
      <OverviewSummaryCards dashboard={dashboard} />
    </GrowthStage>
  );
}
