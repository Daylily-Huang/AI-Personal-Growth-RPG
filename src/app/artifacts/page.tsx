"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { InspectorDrawer } from "@/components/layout/InspectorDrawer";
import {
  ArtifactCard,
  ArtifactInspectorContent,
  ArtifactCreateModal,
  ArtifactEditModal,
  ArtifactLinkManagerModal,
} from "@/components/artifacts";
import { SearchInput } from "@/components/ui/SearchInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Plus,
  Loader2,
  RefreshCw,
  FolderGit2,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import type {
  ArtifactWithCounts,
  ArtifactDetail,
  ArtifactLifecycleStatus,
  Artifact,
} from "@/types/artifact";

const TYPE_OPTIONS: Array<{ id: string; label: string }> = [
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

const STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "active", label: "活跃生效" },
  { id: "draft", label: "草稿" },
  { id: "superseded", label: "已更替" },
  { id: "archived", label: "已归档" },
  { id: "all", label: "全部状态" },
];

const PAGE_SIZE = 24;

export default function ArtifactsPage() {
  const router = useRouter();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedSkillId, setSelectedSkillId] = useState("all");
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; name: string }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Pagination State
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Data States
  const [artifacts, setArtifacts] = useState<ArtifactWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector & Selection States
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ArtifactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Mobile Collapsible Filter Panel State
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const mobileFilterOpenerRef = useRef<HTMLButtonElement | null>(null);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [linkManagerOpen, setLinkManagerOpen] = useState(false);

  // Request sequencing refs to avoid race conditions
  const detailRequestIdRef = useRef(0);
  const listRequestIdRef = useRef(0);

  // Load available skills for left rail filter
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d: { nodes?: Array<{ id: string; name?: string; title?: string; data?: { name?: string } }> }) => {
        if (d.nodes) {
          setAvailableSkills(
            d.nodes.map((n) => ({
              id: n.id,
              name: n.data?.name || n.name || n.title || n.id,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Artifact List with Cancellation & Stale Protection
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const currentReqId = ++listRequestIdRef.current;

    async function fetchList() {
      if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (selectedType !== "all") params.set("type", selectedType);
      // Requirement 4: Always explicitly send status (especially status=all)
      params.set("status", selectedStatus);
      if (selectedSkillId !== "all") params.set("skillId", selectedSkillId);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

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

        const data = (await res.json()) as {
          artifacts?: ArtifactWithCounts[];
          total?: number;
        };

        if (!ignore && listRequestIdRef.current === currentReqId) {
          const incoming = data.artifacts || [];
          setTotal(data.total ?? incoming.length);
          if (offset === 0) {
            setArtifacts(incoming);
          } else {
            setArtifacts((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const uniqueNew = incoming.filter((a) => !existingIds.has(a.id));
              return [...prev, ...uniqueNew];
            });
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!ignore && listRequestIdRef.current === currentReqId) {
          setError(err instanceof Error ? err.message : "获取造物列表异常");
        }
      } finally {
        if (!ignore && listRequestIdRef.current === currentReqId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    void fetchList();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [selectedType, selectedStatus, selectedSkillId, debouncedSearch, offset, refreshKey, router]);

  const refreshArtifacts = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Fetch Selected Artifact Detail for Drawer with Strict Race Guard
  const fetchDetail = useCallback(
    async (id: string) => {
      const currentReqId = ++detailRequestIdRef.current;
      setDetailLoading(true);
      setDetailError(null);
      // Immediately clear previous detail to prevent stale display race
      setSelectedDetail(null);

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
        if (detailRequestIdRef.current === currentReqId) {
          if (data && data.artifact) {
            setSelectedDetail(data);
          } else {
            throw new Error("未能读取到有效的造物数据");
          }
        }
      } catch (err) {
        if (detailRequestIdRef.current === currentReqId) {
          setDetailError(err instanceof Error ? err.message : "加载详情失败");
          setSelectedDetail(null);
        }
      } finally {
        if (detailRequestIdRef.current === currentReqId) {
          setDetailLoading(false);
        }
      }
    },
    [router]
  );

  const handleSelectArtifact = (artifact: ArtifactWithCounts) => {
    setSelectedId(artifact.id);
    setDrawerOpen(true);
    void fetchDetail(artifact.id);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedId(null);
    setSelectedDetail(null);
    setDetailError(null);
  };

  // Status Change (Archive / Restore) strictly bound to targetArtifactId
  const handleStatusChange = async (
    targetArtifactId: string,
    newStatus: ArtifactLifecycleStatus,
    isArchived: boolean
  ) => {
    const res = await fetch(`/api/artifacts/${targetArtifactId}`, {
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
    if (selectedDetail && data.artifact && selectedDetail.artifact.id === targetArtifactId) {
      setSelectedDetail({
        ...selectedDetail,
        artifact: data.artifact,
      });
    }
    refreshArtifacts();
  };

  // Delete Artifact strictly bound to targetArtifactId
  const handleDeleteArtifact = async (
    targetArtifactId: string
  ): Promise<{
    ok: boolean;
    error?: string;
    code?: string;
  }> => {
    try {
      const res = await fetch(`/api/artifacts/${targetArtifactId}`, {
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
    // Auto open newly created artifact
    setSelectedId(newArtifact.id);
    setDrawerOpen(true);
    void fetchDetail(newArtifact.id);
  };

  const handleArtifactUpdated = (updatedArtifact: Artifact) => {
    if (selectedDetail && selectedDetail.artifact.id === updatedArtifact.id) {
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
    selectedType !== "all" || selectedStatus !== "active" || selectedSkillId !== "all" || searchQuery !== "";

  const handleResetFilters = () => {
    setSelectedType("all");
    setSelectedStatus("active");
    setSelectedSkillId("all");
    setSearchQuery("");
    setOffset(0);
  };

  // Filter Rail Component
  const FilterRailContent = (
    <div className="space-y-6 text-left p-4">
      {/* 1. Header & Reset */}
      <div className="flex items-center justify-between">
        <span className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)]">
          成果分类筛选
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-[var(--text-accent)] hover:underline cursor-pointer min-h-[var(--touch-target-min)]"
          >
            重置
          </button>
        )}
      </div>

      {/* 2. Type Filter Section */}
      <div className="space-y-2">
        <label className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-muted)] uppercase tracking-wider block">
          成果类型 (Artifact Types)
        </label>
        <div className="space-y-1">
          {TYPE_OPTIONS.map((t) => {
            const isSelected = selectedType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedType(t.id);
                  setOffset(0);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] text-xs transition-colors min-h-[var(--touch-target-min)] cursor-pointer ${
                  isSelected
                    ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)] border border-[var(--selection-neutral-border)] font-[var(--font-weight-semibold)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lifecycle Status Section */}
      <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
        <label className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-muted)] uppercase tracking-wider block">
          生命周期 (Lifecycle)
        </label>
        <div className="space-y-1">
          {STATUS_OPTIONS.map((s) => {
            const isSelected = selectedStatus === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedStatus(s.id);
                  setOffset(0);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] text-xs transition-colors min-h-[var(--touch-target-min)] cursor-pointer ${
                  isSelected
                    ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)] border border-[var(--selection-neutral-border)] font-[var(--font-weight-semibold)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Linked Skill Filter Section */}
      {availableSkills.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
          <label className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--entity-skill-text)]" />
            <span>关联技能 (Linked Skill)</span>
          </label>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedSkillId("all");
                setOffset(0);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[var(--radius-md)] text-xs transition-colors min-h-[var(--touch-target-min)] cursor-pointer ${
                selectedSkillId === "all"
                  ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)] border border-[var(--selection-neutral-border)] font-[var(--font-weight-semibold)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span>全部技能</span>
            </button>
            {availableSkills.map((sk) => {
              const isSelected = selectedSkillId === sk.id;
              return (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => {
                    setSelectedSkillId(sk.id);
                    setOffset(0);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[var(--radius-md)] text-xs transition-colors min-h-[var(--touch-target-min)] cursor-pointer ${
                    isSelected
                      ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)] border border-[var(--selection-neutral-border)] font-[var(--font-weight-semibold)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="truncate max-w-[170px] text-left">{sk.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div data-testid="artifacts-workspace" className="flex flex-col h-full min-h-0 w-full">
      {/* 1. Top Workspace Header & Action Toolbar */}
      <div className="p-4 lg:px-6 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery("")}
              placeholder="搜索造物标题或摘要..."
              data-testid="artifacts-search-input"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 justify-end">
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

      {/* 2. Main 3-Column Workspace Body (Left Filter Rail + Center Gallery + Right Inspector Sibling) */}
      <div className="flex flex-1 min-h-0 relative items-stretch">
        {/* Left Column: Filter / Taxonomy Rail (Desktop on lg:block) */}
        <aside
          aria-label="成果分类与生命周期筛选"
          className="hidden lg:block w-60 xl:w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-base)] overflow-y-auto"
        >
          {FilterRailContent}
        </aside>

        {/* Center Column: Artifact Gallery & Content */}
        <main
          aria-label="造物陈列库"
          className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 space-y-6"
        >
          {/* Mobile Collapsible Inline Filter Panel */}
          <div className="lg:hidden">
            <button
              ref={mobileFilterOpenerRef}
              type="button"
              onClick={() => setMobileFilterOpen((prev) => !prev)}
              aria-expanded={mobileFilterOpen}
              aria-controls="mobile-filter-panel"
              data-testid="mobile-filter-toggle-btn"
              className="w-full flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] font-[var(--font-weight-medium)] min-h-[var(--touch-target-min)] cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
                <span>成果分类与筛选</span>
                {hasActiveFilters && (
                  <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs bg-[var(--entity-artifact-bg)] text-[var(--entity-artifact-text)] font-mono">
                    已过滤
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileFilterOpen ? "rotate-180" : ""}`}
              />
            </button>

            {mobileFilterOpen && (
              <div
                id="mobile-filter-panel"
                data-testid="mobile-filter-panel"
                className="mt-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] overflow-hidden"
              >
                {FilterRailContent}
              </div>
            )}
          </div>

          {loading && artifacts.length === 0 ? (
            <div
              data-testid="artifacts-loading-state"
              className="flex flex-col items-center justify-center py-28 space-y-3"
            >
              <Loader2 className="w-8 h-8 animate-spin text-[var(--entity-artifact-text)]" />
              <p className="text-xs text-[var(--text-muted)]">正在载入成果造物...</p>
            </div>
          ) : error ? (
            <GlassPanel
              variant="base"
              data-testid="artifacts-error-state"
              className="p-8 text-center space-y-3 max-w-md mx-auto my-12"
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
              className="p-12 text-center space-y-4 max-w-lg mx-auto my-12"
            >
              <FolderGit2 className="w-12 h-12 mx-auto text-[var(--entity-artifact-text)] opacity-60" />
              <div className="space-y-1">
                <h4 className="font-serif font-[var(--font-weight-semibold)] text-base text-[var(--text-primary)]">
                  {hasActiveFilters ? "未找到匹配的造物" : "暂无沉淀成果造物"}
                </h4>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
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
            <div className="space-y-6">
              {/* Responsive Gallery Grid: strictly single column when Inspector is open to prevent card cramming in bounded workspace */}
              <div
                data-testid="artifacts-grid"
                data-inspector-open={drawerOpen ? "true" : "false"}
                className={`grid gap-4 ${
                  drawerOpen
                    ? "grid-cols-1"
                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                }`}
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

              {/* Pagination / Load More */}
              {artifacts.length < total && (
                <div className="flex flex-col items-center justify-center pt-4 pb-8 space-y-2">
                  <SecondaryButton
                    onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                    disabled={loadingMore}
                    loading={loadingMore}
                    icon={<ChevronDown className="w-4 h-4" />}
                    data-testid="artifacts-load-more-btn"
                  >
                    加载更多成果 (已展示 {artifacts.length} / 共 {total} 项)
                  </SecondaryButton>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right Column: InspectorDrawer as Sibling (Push mode on XL, Modal/Sheet on < XL) */}
        <InspectorDrawer
          open={drawerOpen}
          onClose={handleCloseDrawer}
          title="造物全景档案 (Artifact Inspector)"
          mode="auto"
        >
          {detailLoading && !selectedDetail ? (
            <div
              data-testid="inspector-loading-state"
              className="flex flex-col items-center justify-center py-20 space-y-3"
            >
              <Loader2 className="w-6 h-6 animate-spin text-[var(--entity-artifact-text)]" />
              <p className="text-xs text-[var(--text-muted)]">载入造物拓扑数据...</p>
            </div>
          ) : detailError ? (
            <div
              data-testid="inspector-error-state"
              className="p-6 text-center space-y-3"
            >
              <AlertCircle className="w-6 h-6 mx-auto text-[var(--state-danger-text)]" />
              <p className="text-xs text-[var(--text-secondary)]">{detailError}</p>
              <SecondaryButton onClick={() => selectedId && fetchDetail(selectedId)}>
                重试加载
              </SecondaryButton>
            </div>
          ) : selectedDetail?.artifact?.id === selectedId ? (
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
      </div>

      {/* Modals */}
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
  );
}
