"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { InspectorDrawer } from "@/components/layout/InspectorDrawer";
import {
  ArtifactCard,
  ArtifactInspectorContent,
  ArtifactCreateModal,
  ArtifactEditModal,
  ArtifactLinkManagerModal,
} from "@/components/artifacts";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar, type FilterOption } from "@/components/ui/FilterBar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Plus,
  Loader2,
  RefreshCw,
  FolderGit2,
  AlertCircle,
} from "lucide-react";
import type {
  ArtifactWithCounts,
  ArtifactDetail,
  ArtifactLifecycleStatus,
  Artifact,
} from "@/types/artifact";

const TYPE_OPTIONS: FilterOption[] = [
  { id: "all", label: "全部类型" },
  { id: "document", label: "文档" },
  { id: "code_repository", label: "代码仓库" },
  { id: "design_spec", label: "设计规范" },
  { id: "data_analysis", label: "数据分析" },
  { id: "presentation", label: "演示文稿" },
  { id: "synthesis_note", label: "综合笔记" },
  { id: "creative_work", label: "创意作品" },
  { id: "other", label: "其他" },
];

const STATUS_OPTIONS: FilterOption[] = [
  { id: "active", label: "活跃生效" },
  { id: "draft", label: "草稿" },
  { id: "superseded", label: "已更替" },
  { id: "archived", label: "已归档" },
  { id: "all", label: "全部状态" },
];

export default function ArtifactsPage() {
  const router = useRouter();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [refreshKey, setRefreshKey] = useState(0);

  // Data States
  const [artifacts, setArtifacts] = useState<ArtifactWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector & Selection States
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ArtifactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [linkManagerOpen, setLinkManagerOpen] = useState(false);

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Artifact List with Cancellation & Stale Protection
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function fetchList() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedType !== "all") params.set("type", selectedType);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      try {
        const res = await fetch(`/api/artifacts?${params.toString()}`, {
          signal: controller.signal,
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || `加载造物列表失败 (${res.status})`);
        }

        const data = (await res.json()) as { artifacts?: ArtifactWithCounts[] };
        if (!ignore) {
          setArtifacts(data.artifacts || []);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!ignore) {
          setError(err instanceof Error ? err.message : "获取造物列表异常");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchList();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [selectedType, selectedStatus, debouncedSearch, refreshKey, router]);

  const refreshArtifacts = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Fetch Selected Artifact Detail for Drawer
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/artifacts/${id}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(`获取详情失败 (${res.status})`);
      }
      const data = (await res.json()) as ArtifactDetail;
      setSelectedDetail(data);
    } catch {
      // Leave detail as is
    } finally {
      setDetailLoading(false);
    }
  }, [router]);

  const handleSelectArtifact = (artifact: ArtifactWithCounts) => {
    setSelectedId(artifact.id);
    setDrawerOpen(true);
    void fetchDetail(artifact.id);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedId(null);
    setSelectedDetail(null);
  };

  // Status Change (Archive / Restore / Supersede restore)
  const handleStatusChange = async (
    newStatus: ArtifactLifecycleStatus,
    isArchived: boolean
  ) => {
    if (!selectedId) return;
    const res = await fetch(`/api/artifacts/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lifecycleStatus: newStatus,
        isArchived,
      }),
    });

    if (res.status === 401) {
      router.push("/login");
      return;
    }

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || "状态更新失败");
    }

    const data = (await res.json()) as { artifact?: Artifact };
    if (selectedDetail && data.artifact) {
      setSelectedDetail({
        ...selectedDetail,
        artifact: data.artifact,
      });
    }
    refreshArtifacts();
  };

  // Delete Artifact
  const handleDeleteArtifact = async (): Promise<{
    ok: boolean;
    error?: string;
    code?: string;
  }> => {
    if (!selectedId) return { ok: false, error: "未选择造物" };
    try {
      const res = await fetch(`/api/artifacts/${selectedId}`, {
        method: "DELETE",
      });

      if (res.status === 401) {
        router.push("/login");
        return { ok: false, error: "未登录" };
      }

      if (res.status === 204) {
        handleCloseDrawer();
        refreshArtifacts();
        return { ok: true };
      }

      const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      return {
        ok: false,
        error: errData.error || "删除失败",
        code: errData.code,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "网络异常",
      };
    }
  };

  const handleArtifactCreated = (newArtifact: Artifact) => {
    refreshArtifacts();
    // Auto open created artifact
    setSelectedId(newArtifact.id);
    setDrawerOpen(true);
    void fetchDetail(newArtifact.id);
  };

  const handleArtifactUpdated = (updatedArtifact: Artifact) => {
    if (selectedDetail) {
      setSelectedDetail({
        ...selectedDetail,
        artifact: updatedArtifact,
      });
    }
    refreshArtifacts();
  };

  const handleLinksUpdated = async () => {
    if (selectedId) {
      await fetchDetail(selectedId);
      refreshArtifacts();
    }
  };

  const hasActiveFilters =
    selectedType !== "all" || selectedStatus !== "active" || searchQuery !== "";

  const handleResetFilters = () => {
    setSelectedType("all");
    setSelectedStatus("active");
    setSearchQuery("");
  };

  return (
    <AppShell
      title="产出台"
      breadcrumbs={[{ label: "产出台", href: "/artifacts" }]}
    >
      <div data-testid="artifacts-workspace" className="space-y-6">
        {/* 1. Top Action & Filter Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery("")}
              placeholder="搜索造物标题或摘要..."
              data-testid="artifacts-search-input"
            />
          </div>

          <div className="flex items-center gap-3">
            <SecondaryButton
              onClick={refreshArtifacts}
              icon={<RefreshCw className="w-4 h-4" />}
              data-testid="artifacts-refresh-btn"
              disabled={loading}
            >
              刷新
            </SecondaryButton>
            <PrimaryButton
              onClick={() => setCreateModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
              data-testid="artifacts-create-btn"
            >
              新建造物
            </PrimaryButton>
          </div>
        </div>

        {/* 2. Multi-Dimensional Filter Bar */}
        <div className="space-y-2.5 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-muted)] w-16 shrink-0">
              成果类型:
            </span>
            <FilterBar
              options={TYPE_OPTIONS}
              activeId={selectedType}
              onChange={setSelectedType}
              ariaLabel="成果类型筛选"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-muted)] w-16 shrink-0">
              生命周期:
            </span>
            <FilterBar
              options={STATUS_OPTIONS}
              activeId={selectedStatus}
              onChange={setSelectedStatus}
              ariaLabel="生命周期状态筛选"
            />
          </div>
        </div>

        {/* 3. Main Gallery / Workspace Content */}
        {loading && artifacts.length === 0 ? (
          <div
            data-testid="artifacts-loading-state"
            className="flex flex-col items-center justify-center py-24 space-y-3"
          >
            <Loader2 className="w-8 h-8 animate-spin text-[var(--entity-artifact-text)]" />
            <p className="text-xs text-[var(--text-muted)]">正在载入成果造物...</p>
          </div>
        ) : error ? (
          <GlassPanel
            variant="base"
            data-testid="artifacts-error-state"
            className="p-8 text-center space-y-3"
          >
            <AlertCircle className="w-8 h-8 mx-auto text-[var(--state-danger-text)]" />
            <h4 className="text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
              载入造物发生错误
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">{error}</p>
            <SecondaryButton onClick={refreshArtifacts}>重新尝试</SecondaryButton>
          </GlassPanel>
        ) : artifacts.length === 0 ? (
          <GlassPanel
            variant="base"
            data-testid="artifacts-empty-state"
            className="p-12 text-center space-y-4"
          >
            <FolderGit2 className="w-12 h-12 mx-auto text-[var(--entity-artifact-text)] opacity-60" />
            <div className="space-y-1">
              <h4 className="font-serif font-[var(--font-weight-semibold)] text-base text-[var(--text-primary)]">
                {hasActiveFilters ? "未找到匹配的造物" : "暂无沉淀成果造物"}
              </h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                {hasActiveFilters
                  ? "请尝试放宽筛选条件或清空搜索关键词"
                  : "完成日常活动与研习后，产出的代码仓库、架构文档、分析报告等均可在此归档管理并链接到技能树与知识图谱。"}
              </p>
            </div>
            {hasActiveFilters ? (
              <SecondaryButton onClick={handleResetFilters} data-testid="reset-filters-btn">
                重置所有筛选
              </SecondaryButton>
            ) : (
              <PrimaryButton onClick={() => setCreateModalOpen(true)}>
                记录第一个造物
              </PrimaryButton>
            )}
          </GlassPanel>
        ) : (
          <div
            data-testid="artifacts-grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5"
          >
            {artifacts.map((art) => (
              <ArtifactCard
                key={art.id}
                artifact={art}
                selected={selectedId === art.id}
                onClick={() => handleSelectArtifact(art)}
              />
            ))}
          </div>
        )}

        {/* 4. Inspector Drawer */}
        <InspectorDrawer
          open={drawerOpen}
          onClose={handleCloseDrawer}
          title="造物全景档案 (Artifact Inspector)"
        >
          {detailLoading && !selectedDetail ? (
            <div
              data-testid="inspector-loading-state"
              className="flex flex-col items-center justify-center py-20 space-y-3"
            >
              <Loader2 className="w-6 h-6 animate-spin text-[var(--entity-artifact-text)]" />
              <p className="text-xs text-[var(--text-muted)]">载入造物拓扑数据...</p>
            </div>
          ) : selectedDetail ? (
            <ArtifactInspectorContent
              detail={selectedDetail}
              onEdit={() => setEditModalOpen(true)}
              onManageLinks={() => setLinkManagerOpen(true)}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteArtifact}
            />
          ) : (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              未能加载该造物档案
            </div>
          )}
        </InspectorDrawer>

        {/* 5. Modals */}
        <ArtifactCreateModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={handleArtifactCreated}
        />

        {selectedDetail && (
          <ArtifactEditModal
            open={editModalOpen}
            artifact={selectedDetail.artifact}
            onClose={() => setEditModalOpen(false)}
            onUpdated={handleArtifactUpdated}
          />
        )}

        {selectedDetail && (
          <ArtifactLinkManagerModal
            open={linkManagerOpen}
            detail={selectedDetail}
            onClose={() => setLinkManagerOpen(false)}
            onLinksUpdated={handleLinksUpdated}
          />
        )}
      </div>
    </AppShell>
  );
}
