// src/app/knowledge/page.tsx
// Stage 6C Knowledge Map Interactive Canvas Workspace

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import type {
  KnowledgeGraphResponse,
} from "@/lib/knowledge/types";
import KnowledgeFilterPanel, { type DomainItem } from "./components/KnowledgeFilterPanel";
import KnowledgeGraphCanvas, {
  type CanvasFocusTarget,
  type RawGraphEdge,
} from "./components/KnowledgeGraphCanvas";
import KnowledgeDetailPanel from "./components/KnowledgeDetailPanel";
import KnowledgeEdgeDetailPanel from "./components/KnowledgeEdgeDetailPanel";
import type { KnowledgeFlowNodeType } from "./components/KnowledgeNodeView";
import {
  type KnowledgeFilters,
  fetchKnowledgeGraph,
  DEFAULT_FILTERS,
} from "./components/controller";

export default function KnowledgeMapPage() {
  const router = useRouter();

  const [graph, setGraph] = useState<KnowledgeGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<KnowledgeFilters>(DEFAULT_FILTERS);

  // Selection State (Node vs Edge)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Mobile / Viewport State
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<CanvasFocusTarget | null>(null);

  const doFetchGraph = useCallback(async (): Promise<KnowledgeGraphResponse | null> => {
    const res = await fetchKnowledgeGraph(filters);
    if (res.status === 401) {
      router.push("/login");
      return null;
    }
    if (res.error) throw new Error(res.error);
    return res.data;
  }, [filters, router]);

  useEffect(() => {
    let ignore = false;
    doFetchGraph()
      .then((data) => {
        if (!ignore && data) {
          setGraph(data);
          setError(null);
        }
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
  }, [doFetchGraph]);

  function refresh() {
    setLoading(true);
    setError(null);
    doFetchGraph()
      .then((data) => {
        if (data) setGraph(data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "未知错误");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleFilterChange(newFilters: Partial<KnowledgeFilters>) {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function handleSelectNode(nodeId: string | null) {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    if (nodeId && graph) {
      const target = graph.nodes.find((n) => n.id === nodeId);
      if (target?.position) {
        setFocusTarget({ x: target.position.x, y: target.position.y, nonce: Date.now() });
      }
    }
  }

  function handleSelectEdge(edgeId: string | null) {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }

  function handleFocusRoot(rootId: string) {
    setFilters((prev) => ({
      ...prev,
      rootNodeId: rootId,
      depth: prev.depth || 1,
    }));
    if (graph) {
      const target = graph.nodes.find((n) => n.id === rootId);
      if (target?.position) {
        setFocusTarget({ x: target.position.x, y: target.position.y, nonce: Date.now() });
      }
    }
  }

  const domainItems: DomainItem[] = useMemo(() => {
    return (graph?.domains ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      nodeCount: d.nodeCount,
    }));
  }, [graph]);

  const rootNodeTitle = useMemo(() => {
    if (!filters.rootNodeId || !graph) return null;
    return graph.nodes.find((n) => n.id === filters.rootNodeId)?.title ?? null;
  }, [filters.rootNodeId, graph]);

  // ReactFlow Nodes mapping
  const flowNodes: KnowledgeFlowNodeType[] = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        id: node.id,
        title: node.title,
        nodeType: node.nodeType,
        domainId: node.domainId,
        domainName: node.domainName,
        skillId: node.skillId,
        skillName: node.skillName,
        verificationStatus: node.verificationStatus,
        isArchived: node.isArchived,
        confidence: node.confidence,
        sourceType: node.sourceType,
        sourceId: node.sourceId,
        inboundEdgeCount: node.inboundEdgeCount,
        outboundEdgeCount: node.outboundEdgeCount,
        isSelected: selectedNodeId === node.id,
      },
      type: "knowledgeNode",
    }));
  }, [graph, selectedNodeId]);

  const rawEdges: RawGraphEdge[] = useMemo(() => {
    if (!graph) return [];
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relationType: e.relationType,
      verificationStatus: e.verificationStatus,
      isArchived: e.isArchived,
      confidence: e.confidence,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      provenanceNote: e.provenanceNote,
      verifiedAt: e.verifiedAt,
      verifiedBy: e.verifiedBy,
    }));
  }, [graph]);

  const filterPanel = (
    <KnowledgeFilterPanel
      domains={domainItems}
      totalCandidateNodes={graph?.stats?.totalNodes ?? graph?.nodes?.length ?? 0}
      filters={filters}
      rootNodeTitle={rootNodeTitle}
      onFilterChange={handleFilterChange}
      onResetFilters={handleResetFilters}
    />
  );

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      {/* Mobile/Tablet Local Toolbar (below lg) */}
      <div className="flex items-center justify-between gap-2 p-2.5 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="打开筛选面板"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>筛选</span>
        </button>

        <div className="relative flex-1 max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            data-testid="header-search-input"
            value={filters.search}
            onChange={(e) => handleFilterChange({ search: e.target.value })}
            placeholder="搜索知识…"
            aria-label="搜索知识库"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] pl-8 pr-2.5 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none"
          />
        </div>
      </div>

      {/* Main Workspace Row */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* LEFT — Desktop Filter / Navigation Panel (280px) */}
        <aside
          className="hidden w-[var(--sidebar-width-expanded)] shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-base)] lg:flex lg:flex-col"
          aria-label="知识领域与认识论筛选"
        >
          <div className="p-3 border-b border-[var(--border-subtle)]">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                value={filters.search}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                placeholder="搜索概念、命题或关系…"
                aria-label="搜索知识库"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] pl-8 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{filterPanel}</div>
        </aside>

        {/* CENTER — Interactive ReactFlow Canvas */}
        <section className="relative min-w-0 flex-1 h-full" aria-label="知识图谱互动画布">
          {/* Truncation & Progressive View Indicator */}
          {graph?.stats?.isTruncated && (
            <div
              data-testid="graph-truncated-banner"
              className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--state-warning-border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-xs text-[var(--state-warning-text)] backdrop-blur-[var(--glass-blur-md)] shadow-[var(--shadow-overlay)]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--gold-400)] shrink-0" />
              <span>
                当前图谱节点较多，已截取前 {graph.nodes.length} 个核心节点（总计 {graph.stats.totalNodes}）。可点击节点进行局部展开。
              </span>
            </div>
          )}

          {loading ? (
            <div data-testid="loading-indicator" className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="h-8 w-8 animate-spin text-sky-400" aria-hidden="true" />
              <p className="text-sm">正在加载知识图谱与认知事实…</p>
            </div>
          ) : error ? (
            <div data-testid="error-state" className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex items-center gap-2 text-[var(--state-danger-text)]">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">加载失败</span>
              </div>
              <p className="max-w-md text-sm text-[var(--text-muted)]">{error}</p>
              <button
                type="button"
                data-testid="retry-btn"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)]"
              >
                <RefreshCw className="h-4 w-4" /> 重试
              </button>
            </div>
          ) : (graph?.stats?.totalNodes ?? graph?.nodes?.length ?? 0) === 0 ? (
            <div
              data-testid="empty-graph-state"
              className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
            >
              <div className="text-5xl" aria-hidden="true">
                🌐
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">知识图谱暂未生成</h2>
              <p className="max-w-md text-sm text-[var(--text-muted)]">
                完成学习与实践活动后，AI 会根据真实行为推理提炼概念与命题，并在此构建结构化知识网络。
              </p>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              >
                去记录学习活动
              </a>
            </div>
          ) : flowNodes.length === 0 ? (
            <div
              data-testid="no-match-state"
              className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
            >
              <p className="text-sm text-[var(--text-muted)]">当前筛选条件下没有可见的知识节点。</p>
              <button
                type="button"
                data-testid="clear-all-filters-btn"
                onClick={handleResetFilters}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              >
                清除全部筛选
              </button>
            </div>
          ) : (
            <KnowledgeGraphCanvas
              nodes={flowNodes}
              rawEdges={rawEdges}
              selectedEdgeId={selectedEdgeId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
              onClearSelection={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              focusTarget={focusTarget}
              fitKey={`${filters.domainId ?? "all"}|${filters.status}|${filters.nodeType}|${filters.rootNodeId ?? "no-root"}|${filters.search}|${filters.depth}`}
            />
          )}
        </section>

        {/* RIGHT — Desktop Column on xl / Mobile Overlay on < xl (Single-instance responsive container) */}
        {selectedNodeId ? (
          <aside
            className="xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0 xl:border-l xl:border-[var(--border-subtle)] xl:bg-[var(--surface-base)]"
          >
            <button
              type="button"
              aria-label="关闭详情面板"
              onClick={() => setSelectedNodeId(null)}
              className="fixed inset-0 z-40 bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-sm)] xl:hidden"
            />
            <div className="fixed inset-y-0 right-0 z-50 w-[var(--drawer-width-desktop)] max-w-[92vw] border-l border-[var(--border-raised)] bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)] xl:static xl:z-auto xl:w-full xl:h-full xl:border-none xl:shadow-none">
              <KnowledgeDetailPanel
                key={`node-${selectedNodeId}`}
                nodeId={selectedNodeId}
                domains={domainItems}
                onClose={() => setSelectedNodeId(null)}
                onSelectNode={handleSelectNode}
                onFocusRoot={handleFocusRoot}
                onDataChanged={refresh}
              />
            </div>
          </aside>
        ) : selectedEdgeId ? (
          <aside
            className="xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0 xl:border-l xl:border-[var(--border-subtle)] xl:bg-[var(--surface-base)]"
          >
            <button
              type="button"
              aria-label="关闭连边详情"
              onClick={() => setSelectedEdgeId(null)}
              className="fixed inset-0 z-40 bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-sm)] xl:hidden"
            />
            <div className="fixed inset-y-0 right-0 z-50 w-[var(--drawer-width-desktop)] max-w-[92vw] border-l border-[var(--border-raised)] bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)] xl:static xl:z-auto xl:w-full xl:h-full xl:border-none xl:shadow-none">
              <KnowledgeEdgeDetailPanel
                key={`edge-${selectedEdgeId}`}
                edgeId={selectedEdgeId}
                onClose={() => setSelectedEdgeId(null)}
                onSelectNode={handleSelectNode}
                onDataChanged={refresh}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* Mobile Filter Drawer Overlay */}
      {mobileNavOpen && (
        <>
          <button
            type="button"
            aria-label="关闭筛选面板"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-sm)] lg:hidden"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[var(--drawer-width-collapsed)] min-w-[280px] max-w-[85vw] border-r border-[var(--border-raised)] bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)] lg:hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2.5">
              <span className="text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">知识筛选</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="关闭"
                className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-45px)]">{filterPanel}</div>
          </div>
        </>
      )}
    </div>
  );
}
