"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quest, QuestStatus, QuestTreeNode } from "@/lib/store/types";
import { PrimaryButton } from "@/components/ui";
import {
  QuestCard,
  QuestTreeItem,
  QuestsOverviewStats,
  CreateQuestModal,
  QuestsSkeletonLoading,
  QuestsEmptyState,
  QuestsErrorState,
} from "@/components/quests";
import {
  Plus,
  Target,
  FolderTree,
  ListChecks,
  ListFilter,
  CheckCircle2,
} from "lucide-react";

type QuestTab = "tree" | "active" | "all" | "completed";

interface TabItem {
  id: QuestTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export default function QuestsPage() {
  const router = useRouter();
  const [tree, setTree] = useState<QuestTreeNode[]>([]);
  const [flatQuests, setFlatQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<QuestTab>("tree");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const tabRefs = useRef<Record<QuestTab, HTMLButtonElement | null>>({
    tree: null,
    active: null,
    all: null,
    completed: null,
  });

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

      if (!treeRes.ok || !flatRes.ok) throw new Error("加载任务数据失败");

      const treeData = await treeRes.json();
      const flatData = await flatRes.json();

      setTree(treeData.tree ?? []);
      setFlatQuests(flatData.quests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知网络或服务错误");
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

        if (!treeRes.ok || !flatRes.ok) throw new Error("加载任务数据失败");

        const treeData = await treeRes.json();
        const flatData = await flatRes.json();

        if (!ignore) {
          setTree(treeData.tree ?? []);
          setFlatQuests(flatData.quests ?? []);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void fetchQuests();
    return () => {
      ignore = true;
    };
  }, [router]);

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
      if (!res.ok) throw new Error("更新任务状态失败");
      await loadQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新任务状态失败");
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
      if (!res.ok) throw new Error("更新任务进度失败");
      await loadQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新任务进度失败");
    }
  }

  async function handleDeleteQuest(id: string) {
    if (!confirm("确定要删除此任务吗？")) return;
    try {
      const res = await fetch(`/api/quests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除任务失败");
      await loadQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除任务失败");
    }
  }

  const activeCount = flatQuests.filter((q) => q.status === "active").length;
  const completedCount = flatQuests.filter((q) => q.status === "completed").length;
  const mainQuest = flatQuests.find((q) => q.isMainQuest && q.status !== "archived");

  const filteredQuests = flatQuests.filter((q) => {
    if (activeTab === "active") return q.status === "active";
    if (activeTab === "completed") return q.status === "completed";
    return true;
  });

  const tabList: TabItem[] = [
    { id: "tree", label: "任务树视图", icon: FolderTree },
    { id: "active", label: `进行中 (${activeCount})`, icon: ListChecks },
    { id: "all", label: `全部任务 (${flatQuests.length})`, icon: ListFilter },
    { id: "completed", label: `已完成 (${completedCount})`, icon: CheckCircle2 },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === "ArrowRight") {
      targetIndex = (index + 1) % tabList.length;
    } else if (e.key === "ArrowLeft") {
      targetIndex = (index - 1 + tabList.length) % tabList.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = tabList.length - 1;
    }

    if (targetIndex >= 0) {
      e.preventDefault();
      const nextTab = tabList[targetIndex].id;
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header & New Quest Trigger: Local heading is h2 (AppHeader is h1) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-[var(--font-weight-bold)] tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Target className="h-6 w-6 text-[var(--entity-quest-text)]" aria-hidden="true" />
            <span>任务大厅 (Quest System)</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            通过目标分解驱动个人成长，支持层级聚合、关键里程碑攻坚与成长闭环联动。
          </p>
        </div>
        <PrimaryButton
          type="button"
          onClick={() => setShowCreateModal(true)}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          新建任务
        </PrimaryButton>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <QuestsSkeletonLoading />
      ) : (
        <>
          {/* Overview Stats */}
          <QuestsOverviewStats
            totalCount={flatQuests.length}
            activeCount={activeCount}
            completedCount={completedCount}
            mainQuest={mainQuest}
          />

          {/* Error Banner */}
          {error ? (
            <QuestsErrorState error={error} onRetry={loadQuests} />
          ) : null}

          {/* Complete W3C ARIA Tab Pattern with Roving TabIndex & Keyboard Navigation */}
          <div
            role="tablist"
            aria-label="任务视图分类"
            className="flex border-b border-[var(--border-subtle)] text-sm gap-1 sm:gap-2 overflow-x-auto"
          >
            {tabList.map((tab, idx) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="quests-view-tabpanel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 min-h-[var(--touch-target-min)] border-b-2 font-[var(--font-weight-medium)] text-xs sm:text-sm transition-colors cursor-pointer shrink-0 focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] ${
                    isSelected
                      ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panel */}
          <div
            id="quests-view-tabpanel"
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            {flatQuests.length === 0 ? (
              <QuestsEmptyState onCreateQuest={() => setShowCreateModal(true)} />
            ) : activeTab === "tree" ? (
              <div className="space-y-4" data-testid="quests-tree-list">
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
              <div className="grid gap-3" role="feed" aria-label="任务列表">
                {filteredQuests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl">
                    当前筛选下无匹配任务
                  </div>
                ) : (
                  filteredQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      onUpdateStatus={handleUpdateStatus}
                      onUpdateProgress={handleUpdateProgress}
                      onDelete={handleDeleteQuest}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Quest Modal */}
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
