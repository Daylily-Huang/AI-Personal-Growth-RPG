"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Activity,
  DashboardSnapshot,
} from "@/lib/store/types";
import { useOptionalAppShell } from "@/components/layout/AppShellContext";
import type { ArtifactResolutionInput } from "@/types/artifact";

import {
  PlayerHero,
  QuestsOverview,
  QuickLogCard,
  PendingProposals,
  PendingVerifications,
  RecentGrowthFeed,
  ActivityHistoryList,
  OverviewSummaryCards,
  LoadingState,
  ErrorState,
  EmptyState,
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

      setLocalLoading(true);
      await load();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setConfirmingId(null);
    }
  }

  if (loading && !dashboard) {
    return <LoadingState />;
  }

  if (error && !dashboard) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!dashboard) {
    return <EmptyState onRefresh={load} />;
  }

  return (
    <div className="flex w-full flex-col gap-6 max-w-7xl mx-auto">
      {/* LEVEL 1: Player Identity & Progression Hero */}
      <PlayerHero dashboard={dashboard} />

      {/* Non-blocking Error Toast/Alert */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-4 py-3 text-sm text-[var(--state-danger-text)] shadow-xs"
        >
          {error}
        </div>
      ) : null}

      {/* LEVEL 2: Current Action & Quests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <QuestsOverview
            mainQuest={dashboard.mainQuest}
            activeQuests={dashboard.activeQuests}
          />
        </div>
        <div className="lg:col-span-5">
          <QuickLogCard
            rawInput={rawInput}
            setRawInput={setRawInput}
            onSubmit={handleQuickLog}
            submitting={submitting}
          />
        </div>
      </div>

      {/* Pending Proposals & Assessments */}
      <PendingProposals
        assessments={dashboard.pendingAssessments}
        confirmingId={confirmingId}
        onConfirm={handleConfirm}
      />

      {/* Pending Mastery Verifications */}
      <PendingVerifications verifications={dashboard.pendingMasteryVerifications} />

      {/* LEVEL 3: Growth Signals (Recent Growth Feed & Activity History) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6">
          <RecentGrowthFeed transactions={dashboard.recentGrowth} />
        </div>
        <div className="lg:col-span-6">
          <ActivityHistoryList activities={dashboard.activities} />
        </div>
      </div>

      {/* LEVEL 4: Knowledge / Artifacts / Skills Overview Signals */}
      <OverviewSummaryCards dashboard={dashboard} />

      {/* Empty State when no activity and no proposals */}
      {dashboard.activities.length === 0 && dashboard.pendingAssessments.length === 0 ? (
        <EmptyState onRefresh={load} />
      ) : null}
    </div>
  );
}
