// src/app/knowledge/page.tsx
// Stage 6C Knowledge Map Interactive Canvas Workspace

"use client";

import { InspectorDrawer } from "@/components/layout/InspectorDrawer";
import { BaseModal } from "@/components/ui/BaseModal";
import { layoutKnowledgeNodes, filterKnowledgeEdges, type EdgeAuthorityFilter, type RelationFilter, type LayoutMode } from "./components/canvas-layout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const { push } = useRouter();

  const [graph, setGraph] = useState<KnowledgeGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>("clustered");
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [edgeAuthority, setEdgeAuthority] = useState<EdgeAuthorityFilter>("all");
  const [relation, setRelation] = useState<RelationFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedFilters, setLoadedFilters] = useState<KnowledgeFilters | null>(null);

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
      push("/login");
      return null;
    }
    if (res.error) throw new Error(res.error);
    return res.data;
  }, [filters, push]);

  useEffect(() => {
    let ignore = false;
    doFetchGraph()
      .then((data) => {
        if (!ignore && data) {
          setGraph(data);
          setLoadedFilters(filters);
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
  }, [doFetchGraph, filters, refreshKey]);

  function refresh() {
    setLoading(true);
    setError(null);
    setRefreshKey((value) => value + 1);
  }

  function handleFilterChange(newFilters: Partial<KnowledgeFilters>) {
    setLoading(true);
    setError(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }

  function handleResetFilters() {
    if (filters !== DEFAULT_FILTERS) setLoading(true);
    setFilters(DEFAULT_FILTERS);
    setEdgeAuthority("all");
    setRelation("all");
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  const layout = useMemo(() => layoutKnowledgeNodes(graph?.nodes ?? [], layoutMode), [graph, layoutMode]);
  const visibleEdges = useMemo(() => filterKnowledgeEdges(graph?.edges ?? [], graph?.nodes ?? [], edgeAuthority, relation), [graph, edgeAuthority, relation]);
  const visibleSelectedEdgeId = visibleEdges.some((edge) => edge.id === selectedEdgeId) ? selectedEdgeId : null;

  function handleSelectNode(nodeId: string | null) {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    if (nodeId && graph) {
      const target = layout.nodes.find((n) => n.id === nodeId);
      if (target?.position) {
        setFocusTarget((previous) => ({ x: target.position.x, y: target.position.y, nonce: (previous?.nonce ?? 0) + 1 }));
      }
    }
  }

  function handleSelectEdge(edgeId: string | null) {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }

  function handleFocusRoot(rootId: string) {
    setLoading(true);
    setFilters((prev) => ({
      ...prev,
      rootNodeId: rootId,
      depth: prev.depth || 1,
    }));
    if (graph) {
      const target = layout.nodes.find((n) => n.id === rootId);
      if (target?.position) {
        setFocusTarget((previous) => ({ x: target.position.x, y: target.position.y, nonce: (previous?.nonce ?? 0) + 1 }));
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
    return layout.nodes.map((node) => ({
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
  }, [graph, layout, selectedNodeId]);

  const rawEdges: RawGraphEdge[] = useMemo(() => {
    if (!graph) return [];
    return visibleEdges.map((e) => ({
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
  }, [graph, visibleEdges]);

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
    <div className="flex flex-col h-[calc(100dvh-var(--header-height)-var(--mobile-nav-height))] md:h-[calc(100dvh-var(--header-height))] w-full min-h-0 overflow-hidden">
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
          <div className="flex-1 overflow-y-auto">{!mobileNavOpen && filterPanel}</div>
        </aside>

        {/* CENTER — Interactive ReactFlow Canvas */}
        <section className="relative min-w-0 flex-1 h-full flex flex-col" aria-label="知识图谱互动画布">
          <div className="shrink-0 flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-xs text-[var(--text-secondary)] [&_select]:rounded-[var(--radius-md)] [&_select]:border [&_select]:border-[var(--border-subtle)] [&_select]:bg-[var(--surface-raised)] [&_select]:p-2 [&_select]:min-h-[var(--touch-target-min)]">
            <label>布局 <select aria-label="画布布局" value={layoutMode} onChange={(event) => { setFocusTarget(null); setLayoutMode(event.target.value as LayoutMode); }}><option value="clustered">领域 / 类型聚类</option><option value="relations">关系布局</option></select></label>
            <label>关系权威 <select aria-label="关系权威筛选" value={edgeAuthority} onChange={(event) => { setSelectedEdgeId(null); setEdgeAuthority(event.target.value as EdgeAuthorityFilter); }}><option value="all">当前全部关系</option><option value="verified">已验证</option><option value="inferred">AI 提案</option><option value="rejected">已否决</option><option value="superseded">已替代</option><option value="archived">已归档</option></select></label>
            <label>关系类型 <select aria-label="关系类型筛选" value={relation} onChange={(event) => { setSelectedEdgeId(null); setRelation(event.target.value as RelationFilter); }}><option value="all">全部类型</option><option value="prerequisite">前置依赖</option><option value="contains">包含</option><option value="supports">支持</option><option value="contradicts">矛盾（无方向）</option><option value="relates_to">相关（无方向）</option></select></label>
            <button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode(viewMode === "graph" ? "list" : "graph")} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2">{viewMode === "graph" ? "切换列表" : "切换画布"}</button>
            <span role="status">{flowNodes.length} 个节点 · {rawEdges.length} 条关系</span>
          </div>
          <div className="relative flex-1 min-h-0">
          {/* Truncation & Progressive View Indicator */}
          {graph?.stats?.isTruncated && (
            <div
              data-testid="graph-truncated-banner"
              className="absolute left-4 top-4 z-[var(--z-canvas)] flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--state-warning-border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-xs text-[var(--state-warning-text)] backdrop-blur-[var(--glass-blur-md)] shadow-[var(--shadow-overlay)]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--state-warning-text)] shrink-0" />
              <span>
                当前图谱节点较多，已截取前 {graph.nodes.length} 个核心节点（总计 {graph.stats.totalNodes}）。可点击节点进行局部展开。
              </span>
            </div>
          )}

          {loading || (loadedFilters !== filters && !error) ? (
            <div data-testid="loading-indicator" className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none text-[var(--entity-knowledge-text)]" aria-hidden="true" />
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
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              >
                去记录学习活动
              </Link>
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
          ) : viewMode === "list" ? (
            <div className="h-full overflow-auto p-4 space-y-4">
              <h2 className="font-serif text-lg text-[var(--text-primary)]">知识节点</h2>
              <ul className="space-y-2">{layout.nodes.map((node) => <li key={node.id}><button type="button" onClick={() => handleSelectNode(node.id)} className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left text-sm text-[var(--text-primary)]">{node.title}<span className="block text-xs text-[var(--text-secondary)]">{node.domainName ?? "未分类领域"} · {node.verificationStatus}{node.isArchived ? " · 已归档" : ""}</span></button></li>)}</ul>
              <h2 className="font-serif text-lg text-[var(--text-primary)]">知识关系</h2>
              {rawEdges.length === 0 && <p className="text-sm text-[var(--text-secondary)]">当前筛选下没有关系。</p>}
              <ul className="space-y-2">{rawEdges.map((edge) => <li key={edge.id}><button type="button" onClick={() => handleSelectEdge(edge.id)} className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3 text-left text-sm text-[var(--text-primary)]">{graph?.nodes.find((node) => node.id === edge.source)?.title} {edge.relationType === "contradicts" || edge.relationType === "relates_to" ? "—" : "→"} {graph?.nodes.find((node) => node.id === edge.target)?.title}<span className="block text-xs">{edge.relationType} · {edge.verificationStatus}{edge.isArchived ? " · 已归档" : ""}</span></button></li>)}</ul>
            </div>
          ) : (
            <KnowledgeGraphCanvas
              nodes={flowNodes}
              clusters={layout.clusters}
              rawEdges={rawEdges}
              selectedEdgeId={visibleSelectedEdgeId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
              onClearSelection={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              focusTarget={focusTarget}
              fitKey={`${layoutMode}|${graph?.nodes.map((node) => node.id).join(",")}|${filters.domainId ?? "all"}|${filters.status}|${filters.nodeType}|${filters.rootNodeId ?? "no-root"}|${filters.search}|${filters.depth}`}
            />
          )}
          </div>
        </section>

        {/* Shared responsive inspector: desktop push / mobile modal (xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0 xl:hidden xl:static) */}
        <InspectorDrawer open={Boolean(selectedNodeId || visibleSelectedEdgeId)} onClose={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }} title={selectedNodeId ? "知识节点档案" : "知识关系档案"} mode="auto">
          {selectedNodeId ? <KnowledgeDetailPanel key={`node-${selectedNodeId}`} nodeId={selectedNodeId} domains={domainItems} onClose={() => setSelectedNodeId(null)} onSelectNode={handleSelectNode} onFocusRoot={handleFocusRoot} onDataChanged={refresh} />
            : visibleSelectedEdgeId ? <KnowledgeEdgeDetailPanel key={`edge-${visibleSelectedEdgeId}`} edgeId={visibleSelectedEdgeId} onClose={() => setSelectedEdgeId(null)} onSelectNode={handleSelectNode} onDataChanged={refresh} /> : null}
        </InspectorDrawer>
      </div>

      <BaseModal open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="知识筛选">
        {mobileNavOpen && filterPanel}
      </BaseModal>
    </div>
  );
}
