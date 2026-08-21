"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quest, QuestSize, QuestStatus, QuestTreeNode, QuestType } from "@/lib/store/types";
import {
  Sparkles,
  Plus,
  Target,
  Crown,
  Flame,
  CheckCircle2,
  FolderTree,
  ListFilter,
  LogOut,
  Database as DatabaseIcon,
  Play,
  Pause,
  Trash2,
  Calendar,
  Layers,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const QUEST_TYPE_CONFIG: Record<QuestType, { label: string; icon: string; color: string }> = {
  learning: { label: "学习吸收", icon: "📖", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  skill: { label: "技能刻意练习", icon: "⚡", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  production: { label: "真实产出", icon: "🛠️", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  physical: { label: "体能恢复", icon: "🏃", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  maintenance: { label: "日常维护", icon: "🧹", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  reflection: { label: "复盘沉淀", icon: "🪞", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
};

const QUEST_SIZE_CONFIG: Record<QuestSize, { label: string; badge: string }> = {
  main: { label: "主线 Main", badge: "bg-amber-400/20 text-amber-300 border-amber-400/30" },
  epic: { label: "史诗 Epic", badge: "bg-purple-400/20 text-purple-300 border-purple-400/30" },
  major: { label: "重要 Major", badge: "bg-indigo-400/20 text-indigo-300 border-indigo-400/30" },
  standard: { label: "标准 Standard", badge: "bg-sky-400/20 text-sky-300 border-sky-400/30" },
  minor: { label: "次要 Minor", badge: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
  micro: { label: "微任务 Micro", badge: "bg-zinc-700/30 text-zinc-400 border-zinc-700/40" },
};

export default function QuestsPage() {
  const router = useRouter();
  const [tree, setTree] = useState<QuestTreeNode[]>([]);
  const [flatQuests, setFlatQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "active" | "all" | "completed">("tree");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isConfigured = isSupabaseConfigured();

  const loadQuests = useCallback(async () => {
    try {
      setError(null);
      const [treeRes, flatRes] = await Promise.all([
        fetch("/api/quests?tree=true"),
        fetch("/api/quests"),
      ]);

      if (treeRes.status === 401 || flatRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!treeRes.ok || !flatRes.ok) throw new Error("Failed to load quests");

      const treeData = await treeRes.json();
      const flatData = await flatRes.json();

      setTree(treeData.tree ?? []);
      setFlatQuests(flatData.quests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let ignore = false;
    async function fetchQuests() {
      try {
        const [treeRes, flatRes] = await Promise.all([
          fetch("/api/quests?tree=true"),
          fetch("/api/quests"),
        ]);

        if (treeRes.status === 401 || flatRes.status === 401) {
          router.push("/login");
          return;
        }

        if (!treeRes.ok || !flatRes.ok) throw new Error("Failed to load quests");

        const treeData = await treeRes.json();
        const flatData = await flatRes.json();

        if (!ignore) {
          setTree(treeData.tree ?? []);
          setFlatQuests(flatData.quests ?? []);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void fetchQuests();
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

  async function handleUpdateStatus(id: string, newStatus: QuestStatus) {
    try {
      const res = await fetch(`/api/quests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          progress: newStatus === "completed" ? 100 : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await loadQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update quest status");
    }
  }

  async function handleUpdateProgress(id: string, progress: number) {
    try {
      const res = await fetch(`/api/quests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress,
          status: progress >= 100 ? "completed" : "active",
        }),
      });
      if (!res.ok) throw new Error("Failed to update progress");
      await loadQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update progress");
    }
  }

  async function handleDeleteQuest(id: string) {
    if (!confirm("确定要删除此任务吗？")) return;
    try {
      const res = await fetch(`/api/quests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete quest");
      await loadQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete quest");
    }
  }

  const activeCount = flatQuests.filter((q) => q.status === "active").length;
  const completedCount = flatQuests.filter((q) => q.status === "completed").length;
  const mainQuest = flatQuests.find((q) => q.isMainQuest && q.status !== "archived");

  return (
    <div className="min-h-screen bg-[#0b0f17] text-zinc-100">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d1320]/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-amber-300" />
            AI Personal Growth RPG
          </div>
          <nav className="flex items-center gap-4 text-xs">
            <a href="/dashboard" className="text-zinc-400 hover:text-zinc-200">
              Dashboard
            </a>
            <a href="/quests" className="font-medium text-amber-300">
              Quests
            </a>
            <a href="/skills" className="text-zinc-400 hover:text-zinc-200">
              Skill Tree
            </a>
            <span className="hidden sm:inline-flex items-center gap-1 rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
              <DatabaseIcon className="h-3 w-3 text-emerald-400" />
              {isConfigured ? "Supabase Realtime Engine" : "Demo Mode · Local Ledger"}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
              title="退出登录"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Title Bar & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Target className="h-6 w-6 text-amber-400" />
              任务大厅 (Quest System)
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              通过目标分解驱动个人成长，支持层级聚合、Boss 挑战与成长闭环联动。
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            新建任务
          </button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs text-zinc-400">总任务数</div>
            <div className="text-2xl font-bold text-white mt-1">{flatQuests.length}</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="text-xs text-amber-400">进行中 (Active)</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="text-xs text-emerald-400">已完成 (Completed)</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{completedCount}</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-xs text-purple-400">主线状态 (Main Quest)</div>
            <div className="text-sm font-semibold text-purple-300 mt-1 truncate">
              {mainQuest ? `${mainQuest.title} (${Math.round(mainQuest.progress)}%)` : "未设定主线"}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* Tab Filters */}
        <div className="flex border-b border-white/10 text-sm">
          <button
            onClick={() => setActiveTab("tree")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === "tree"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FolderTree className="h-4 w-4" />
            任务树视图 (Tree View)
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === "active"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Flame className="h-4 w-4 text-amber-400" />
            进行中 ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === "all"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ListFilter className="h-4 w-4" />
            全部任务 ({flatQuests.length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === "completed"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            已完成 ({completedCount})
          </button>
        </div>

        {/* List / Tree View */}
        {loading ? (
          <div className="flex justify-center py-16 text-zinc-500">加载任务树中...</div>
        ) : flatQuests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-zinc-400">
            <Target className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
            <div className="text-base font-medium text-zinc-300">暂无任务</div>
            <p className="text-xs text-zinc-500 mt-1">创建你的第一个主线或阶段性学习任务吧！</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300"
            >
              <Plus className="h-3.5 w-3.5" />
              创建主线任务
            </button>
          </div>
        ) : activeTab === "tree" ? (
          <div className="space-y-4">
            {tree.map((node) => (
              <QuestTreeItem
                key={node.id}
                node={node}
                level={0}
                onUpdateStatus={handleUpdateStatus}
                onUpdateProgress={handleUpdateProgress}
                onDelete={handleDeleteQuest}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {flatQuests
              .filter((q) => {
                if (activeTab === "active") return q.status === "active";
                if (activeTab === "completed") return q.status === "completed";
                return true;
              })
              .map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateProgress={handleUpdateProgress}
                  onDelete={handleDeleteQuest}
                />
              ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal ? (
        <CreateQuestModal
          existingQuests={flatQuests}
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            setShowCreateModal(false);
            await loadQuests();
          }}
        />
      ) : null}
    </div>
  );
}

function QuestTreeItem({
  node,
  level,
  onUpdateStatus,
  onUpdateProgress,
  onDelete,
}: {
  node: QuestTreeNode;
  level: number;
  onUpdateStatus: (id: string, s: QuestStatus) => void;
  onUpdateProgress: (id: string, p: number) => void;
  onDelete: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={`flex flex-col gap-2 ${level > 0 ? "ml-6 pl-4 border-l border-white/10" : ""}`}>
      <QuestCard
        quest={node}
        hasChildren={hasChildren}
        childrenCount={node.children?.length ?? 0}
        onUpdateStatus={onUpdateStatus}
        onUpdateProgress={onUpdateProgress}
        onDelete={onDelete}
      />
      {hasChildren ? (
        <div className="flex flex-col gap-2 mt-1">
          {node.children.map((child) => (
            <QuestTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onUpdateStatus={onUpdateStatus}
              onUpdateProgress={onUpdateProgress}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuestCard({
  quest,
  hasChildren,
  childrenCount,
  onUpdateStatus,
  onUpdateProgress,
  onDelete,
}: {
  quest: Quest;
  hasChildren?: boolean;
  childrenCount?: number;
  onUpdateStatus: (id: string, s: QuestStatus) => void;
  onUpdateProgress: (id: string, p: number) => void;
  onDelete: (id: string) => void;
}) {
  const typeMeta = QUEST_TYPE_CONFIG[quest.questType] ?? QUEST_TYPE_CONFIG.learning;
  const sizeMeta = QUEST_SIZE_CONFIG[quest.questSize] ?? QUEST_SIZE_CONFIG.standard;

  return (
    <div
      className={`rounded-xl border p-4 transition-all bg-slate-900/70 ${
        quest.isMainQuest
          ? "border-amber-500/40 shadow-lg shadow-amber-500/5 bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900"
          : quest.isBoss
            ? "border-rose-500/40 bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900"
            : "border-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <div className="flex flex-wrap items-center gap-2">
            {quest.isMainQuest ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-950">
                <Crown className="h-3 w-3" />
                主线
              </span>
            ) : null}
            {quest.isBoss ? (
              <span className="inline-flex items-center gap-1 rounded bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                <Flame className="h-3 w-3" />
                Boss 战
              </span>
            ) : null}
            <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${sizeMeta.badge}`}>
              {sizeMeta.label}
            </span>
            <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${typeMeta.color}`}>
              <span>{typeMeta.icon}</span>
              <span>{typeMeta.label}</span>
            </span>
            {hasChildren ? (
              <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 flex items-center gap-1">
                <Layers className="h-3 w-3 text-sky-400" />
                {childrenCount} 个子任务
              </span>
            ) : null}
          </div>
          <h3 className="text-base font-semibold text-white">{quest.title}</h3>
          {quest.description ? (
            <p className="text-xs text-zinc-400 line-clamp-2">{quest.description}</p>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {quest.status === "available" ? (
            <button
              onClick={() => onUpdateStatus(quest.id, "active")}
              className="inline-flex items-center gap-1 rounded bg-sky-500/20 border border-sky-500/30 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/30 cursor-pointer"
            >
              <Play className="h-3 w-3" /> 开始
            </button>
          ) : quest.status === "active" ? (
            <>
              <button
                onClick={() => onUpdateStatus(quest.id, "paused")}
                className="inline-flex items-center gap-1 rounded bg-zinc-700/50 border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                title="暂停任务"
              >
                <Pause className="h-3 w-3" />
              </button>
              <button
                onClick={() => onUpdateStatus(quest.id, "completed")}
                className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
              >
                <CheckCircle2 className="h-3 w-3" /> 完成
              </button>
            </>
          ) : quest.status === "paused" ? (
            <button
              onClick={() => onUpdateStatus(quest.id, "active")}
              className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30 cursor-pointer"
            >
              <Play className="h-3 w-3" /> 继续
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> 已完成
            </span>
          )}

          <button
            onClick={() => onDelete(quest.id)}
            className="rounded p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
            title="删除任务"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress & Meta Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs text-zinc-400">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <span className="text-zinc-400 text-[11px]">进度 ({Math.round(quest.progress)}%)</span>
          <div className="relative h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                quest.status === "completed"
                  ? "bg-emerald-400"
                  : quest.isMainQuest
                    ? "bg-amber-400"
                    : "bg-sky-400"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, quest.progress))}%` }}
            />
          </div>
          {quest.status !== "completed" ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateProgress(quest.id, Math.min(100, quest.progress + 25))}
                className="rounded bg-white/5 hover:bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 cursor-pointer"
              >
                +25%
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span>难度: {(quest.difficulty * 100).toFixed(0)}%</span>
          <span>目标对齐: {(quest.goalAlignment * 100).toFixed(0)}%</span>
          {quest.deadline ? (
            <span className="inline-flex items-center gap-1 text-zinc-400">
              <Calendar className="h-3 w-3" />
              {new Date(quest.deadline).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreateQuestModal({
  existingQuests,
  onClose,
  onCreated,
}: {
  existingQuests: Quest[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questType, setQuestType] = useState<QuestType>("learning");
  const [questSize, setQuestSize] = useState<QuestSize>("standard");
  const [parentQuestId, setParentQuestId] = useState<string>("");
  const [isMainQuest, setIsMainQuest] = useState(false);
  const [isBoss, setIsBoss] = useState(false);
  const [difficulty, setDifficulty] = useState(0.5);
  const [goalAlignment, setGoalAlignment] = useState(0.8);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          questType,
          questSize: isMainQuest ? "main" : questSize,
          parentQuestId: parentQuestId || null,
          isMainQuest,
          isBoss,
          difficulty,
          goalAlignment,
          status: "active",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "创建任务失败");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-400" />
          新建任务目标
        </h2>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">任务名称 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：深入掌握 PostgreSQL RLS 与安全函数策略"
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">任务描述</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="具体验收标准或关键里程碑..."
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">任务类型</label>
              <select
                value={questType}
                onChange={(e) => setQuestType(e.target.value as QuestType)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                {Object.entries(QUEST_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.icon} {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">任务规模</label>
              <select
                value={questSize}
                disabled={isMainQuest}
                onChange={(e) => setQuestSize(e.target.value as QuestSize)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none disabled:opacity-50"
              >
                {Object.entries(QUEST_SIZE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">上级父任务 (可选树形关联)</label>
            <select
              value={parentQuestId}
              onChange={(e) => setParentQuestId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
            >
              <option value="">-- 无上级任务 (作为顶级任务) --</option>
              {existingQuests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.isMainQuest ? "👑 [主线] " : ""}{q.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>任务难度 (Difficulty)</span>
                <span className="text-amber-400 font-mono">{(difficulty * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={difficulty}
                onChange={(e) => setDifficulty(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>目标对齐 (Alignment)</span>
                <span className="text-sky-400 font-mono">{(goalAlignment * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={goalAlignment}
                onChange={(e) => setGoalAlignment(parseFloat(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isMainQuest}
                onChange={(e) => setIsMainQuest(e.target.checked)}
                className="rounded border-white/20 bg-slate-950 text-amber-400 focus:ring-0"
              />
              <span className="font-semibold text-amber-300">设为当前主线任务</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isBoss}
                onChange={(e) => setIsBoss(e.target.checked)}
                className="rounded border-white/20 bg-slate-950 text-rose-400 focus:ring-0"
              />
              <span className="font-semibold text-rose-300">Boss 关卡挑战</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs text-zinc-400 hover:text-white"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              {submitting ? "创建中..." : "确认创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
