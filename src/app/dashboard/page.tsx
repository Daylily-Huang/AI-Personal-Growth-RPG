"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Activity,
  Assessment,
  MasteryVerification,
  XpTransaction,
} from "@/lib/store/types";
import type { DashboardSnapshot } from "@/lib/store/dashboard.service";
import {
  Sparkles,
  Zap,
  Check,
  RefreshCw,
  Loader2,
  TrendingUp,
  BookOpen,
  Plus,
  ShieldAlert,
  LogOut,
  Database as DatabaseIcon,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data = await res.json();
      setDashboard(data.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let ignore = false;

    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load dashboard");
        const data = await res.json();
        if (!ignore) setDashboard(data.dashboard);
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void fetchDashboard();
    return () => {
      ignore = true;
    };
  }, [router]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  async function handleQuickLog(e: React.FormEvent) {
    e.preventDefault();
    const text = rawInput.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);
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
      setLoading(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(assessmentId: string) {
    setConfirmingId(assessmentId);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/confirm`, { method: "POST" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to confirm assessment");
      setLoading(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setConfirmingId(null);
    }
  }

  if (loading && !dashboard) {
    return <Shell onLogout={handleLogout} isConfigured={isConfigured}><LoadingState /></Shell>;
  }

  if (error && !dashboard) {
    return <Shell onLogout={handleLogout} isConfigured={isConfigured}><ErrorState message={error} onRetry={load} /></Shell>;
  }

  if (!dashboard) {
    return <Shell onLogout={handleLogout} isConfigured={isConfigured}><EmptyState onRefresh={load} /></Shell>;
  }

  return (
    <Shell onLogout={handleLogout} isConfigured={isConfigured}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PlayerHeader dashboard={dashboard} />

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <QuickLogForm
          rawInput={rawInput}
          setRawInput={setRawInput}
          onSubmit={handleQuickLog}
          submitting={submitting}
        />

        <PendingProposals
          assessments={dashboard.pendingAssessments}
          confirmingId={confirmingId}
          onConfirm={handleConfirm}
        />

        <PendingVerifications verifications={dashboard.pendingMasteryVerifications} />

        <RecentGrowth transactions={dashboard.recentGrowth} />

        <ActivityHistory activities={dashboard.activities} />

        {dashboard.activities.length === 0 && dashboard.pendingAssessments.length === 0 ? (
          <EmptyState onRefresh={load} />
        ) : null}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  onLogout,
  isConfigured,
}: {
  children: React.ReactNode;
  onLogout: () => void;
  isConfigured: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#0b0f17] text-zinc-100">
      <header className="border-b border-white/5 bg-[#0d1320]/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-amber-300" />
            AI Personal Growth RPG
          </div>
          <nav className="flex items-center gap-4 text-xs">
            <a href="/dashboard" className="font-medium text-amber-300">
              Dashboard
            </a>
            <a href="/skills" className="text-zinc-400 hover:text-zinc-200">
              Skill Tree
            </a>
            <span className="hidden sm:inline-flex items-center gap-1 rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
              <DatabaseIcon className="h-3 w-3 text-emerald-400" />
              {isConfigured ? "Supabase Realtime Engine" : "Demo Mode · Local Ledger"}
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
              title="退出登录"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function PlayerHeader({ dashboard }: { dashboard: DashboardSnapshot }) {
  const { player, levelProgress, skills } = dashboard;
  return (
    <section className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500">
            Player
            <span className="ml-2 rounded bg-sky-400/10 px-1.5 py-0.5 normal-case tracking-normal text-sky-300">
              Provisional XP Level
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold">XP Lv.{player.playerLevel}</span>
            <span className="text-sm text-zinc-400">
              {player.totalXp} XP total
            </span>
          </div>
          <div className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-400/80 transition-all"
              style={{ width: `${Math.round(levelProgress.progress * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {levelProgress.xpIntoLevel} / {levelProgress.xpNeededForNext} XP to next level
          </div>
        </div>
        <div className="flex gap-6">
          <StateMeter label="Energy" value={player.energy} />
          <StateMeter label="Focus" value={player.focus} />
          <StateMeter label="Momentum" value={player.momentum} />
        </div>
      </div>
      {skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
          {skills.slice(0, 6).map((skill) => (
            <div key={skill.name} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
              <span className="text-zinc-300">{skill.name}</span>{" "}
              <span className="text-amber-300">XP Lv.{skill.level}</span>{" "}
              <span className="text-zinc-500">M{skill.masteryLevel}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StateMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function QuickLogForm({
  rawInput,
  setRawInput,
  onSubmit,
  submitting,
}: {
  rawInput: string;
  setRawInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Plus className="h-4 w-4 text-amber-300" />
        Quick Log — 记录你刚才在现实中做了什么
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="例如：今天读了 1.5 小时 LC 方法，理解了 LR 与 LC 的区别，但还没有实际跑数据"
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-300/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!rawInput.trim() || submitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {submitting ? "AI 评估中…" : "记录并评估"}
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        AI 只会生成 Proposal；你确认后，服务器 Growth Engine 才会计算并写入 XP Ledger。
      </p>
    </section>
  );
}

function PendingProposals({
  assessments,
  confirmingId,
  onConfirm,
}: {
  assessments: Assessment[];
  confirmingId: string | null;
  onConfirm: (id: string) => void;
}) {
  if (assessments.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        待确认的 AI 评估
      </h2>
      {assessments.map((assessment) => (
        <div key={assessment.id} className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-400">Activity</div>
              <div className="font-medium">{assessment.proposal.activity.type}</div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              Confidence {Math.round(assessment.confidence * 100)}%
              <br />
              {assessment.modelName}
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <InfoBox label="Evidence" value={`E${assessment.proposal.evidence.level}`} detail={assessment.proposal.evidence.explanation} />
            <InfoBox
              label="Mastery"
              value={assessment.proposal.mastery_changes[0]
                ? `M${assessment.proposal.mastery_changes[0].from_level} → M${assessment.proposal.mastery_changes[0].proposed_level}`
                : "—"}
              detail={assessment.proposal.mastery_changes[0]?.reason}
            />
            <InfoBox
              label="Affected Skill"
              value={assessment.proposal.affected_skills[0]?.name ?? "—"}
              detail={assessment.proposal.affected_skills[0]?.reason}
            />
            <InfoBox
              label="XP Semantics"
              value={`base ${assessment.proposal.xp_semantics.base_value}`}
              detail={`difficulty ${Math.round(assessment.proposal.xp_semantics.difficulty * 100)}% · novelty ${Math.round(assessment.proposal.xp_semantics.novelty * 100)}%`}
            />
            <InfoBox
              label="重复风险（AI 估算）"
              value={assessment.proposal.xp_semantics.repetition_risk}
              detail="非最终判定；服务器确认时重新计算"
            />
          </div>
          {assessment.proposal.uncertainty_notes.length > 0 ? (
            <div className="mt-3 text-xs text-zinc-500">
              {assessment.proposal.uncertainty_notes.join(" ")}
            </div>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => onConfirm(assessment.id)}
              disabled={confirmingId === assessment.id}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50 cursor-pointer"
            >
              {confirmingId === assessment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              确认并结算
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function InfoBox({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
      {detail ? <div className="mt-1 text-xs text-zinc-500">{detail}</div> : null}
    </div>
  );
}

function PendingVerifications({ verifications }: { verifications: MasteryVerification[] }) {
  if (verifications.length === 0) return null;
  return (
    <section className="rounded-xl border border-sky-300/20 bg-sky-300/[0.04] p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-200">
        <ShieldAlert className="h-4 w-4" />
        Mastery 待验证
      </div>
      <ul className="space-y-2">
        {verifications.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium text-sky-200">{v.skillName}</span>{" "}
              <span className="text-zinc-400">M{v.fromLevel} → M{v.toLevel}</span>
            </span>
            <span className="text-xs text-zinc-500">
              E{v.evidenceLevel} · Pending · 尚未授予
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-500">
        这些升级需要验证以后才会真正生效（不会自动授予）。
      </p>
    </section>
  );
}

function RecentGrowth({ transactions }: { transactions: XpTransaction[] }) {
  if (transactions.length === 0) return null;
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <TrendingUp className="h-4 w-4 text-emerald-300" />
        Recent Growth
      </div>
      <ul className="divide-y divide-white/5">
        {transactions.slice(0, 5).map((tx) => (
          <li key={tx.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm">{tx.reason}</div>
              <div className="text-xs text-zinc-500">
                {tx.skillName} · {new Date(tx.createdAt).toLocaleString()}
              </div>
              {tx.repetitionPenalty != null ? (
                <div className="mt-0.5 text-xs text-amber-300/80">
                  {tx.repetitionPenalty < 1
                    ? `重复 ×${tx.repetitionPenalty}（第 ${tx.repetitionCount} 次类似，服务器判定）`
                    : `无重复惩罚（第 ${tx.repetitionCount} 次类似，服务器判定）`}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-300">
              +{tx.amount} XP
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityHistory({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null;
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <BookOpen className="h-4 w-4 text-sky-300" />
        Activity History
      </div>
      <ul className="divide-y divide-white/5">
        {activities.slice(0, 10).map((activity) => (
          <li key={activity.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm">{activity.title}</div>
              <div className="text-xs text-zinc-500">
                {activity.status} · {new Date(activity.createdAt).toLocaleString()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-zinc-400">
      <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
      <p className="text-sm">Loading your growth world…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-red-300">加载失败</div>
      <p className="max-w-md text-sm text-zinc-400">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">🌱</div>
      <h2 className="text-xl font-semibold">还没有成长记录</h2>
      <p className="max-w-md text-sm text-zinc-400">
        完成第一次 Growth Assessment 后，系统会根据真实行为建立技能树和成长账本。
      </p>
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" /> Refresh
      </button>
    </div>
  );
}
