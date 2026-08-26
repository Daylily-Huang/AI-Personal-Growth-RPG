// src/app/knowledge/page.tsx
// Stage 6C Knowledge Map Interactive Canvas Workspace

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Network,
  AlertCircle,
  Sparkles,
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
  DEFAULT_FILTERS,
  fetchKnowledgeGraph,
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
  const [isDesktopDetail, setIsDesktopDetail] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setIsDesktopDetail(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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
      .finally(() => setLoading(false));
  }

  function handleFilterChange(updates: Partial<KnowledgeFilters>) {
    setFilters((prev) => ({ ...prev, ...updates }));
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function handleSelectNode(nodeId: string | null) {
    setSelectedEdgeId(null);
    setSelectedNodeId(nodeId);

    if (nodeId && graph) {
      const targetNode = graph.nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        setFocusTarget({
          x: targetNode.position.x,
          y: targetNode.position.y,
          nonce: Date.now(),
        });
      }
    }
  }

  function handleSelectEdge(edgeId: string | null) {
    setSelectedNodeId(null);
    setSelectedEdgeId(edgeId);
  }

  function handleClearSelection() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function handleFocusRoot(rootId: string) {
    setFilters((prev) => ({
      ...prev,
      rootNodeId: rootId,
      depth: prev.depth || 1,
    }));
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
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
      totalCandidateNodes={graph?.stats.totalNodes ?? 0}
      filters={filters}
      rootNodeTitle={rootNodeTitle}
      onFilterChange={handleFilterChange}
      onResetFilters={handleResetFilters}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0f17] text-zinc-100">
      {/* Header Navigation */}
      <header className="z-40 shrink-0 border-b border-white/5 bg-[#0d1320]/80 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="打开筛选面板"
              className="rounded-md p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Network aria-hidden="true" className="h-5 w-5 text-sky-400" />
            <span>Knowledge Map</span>
            <span className="ml-1 hidden rounded-full bg-sky-950 px-2 py-0.5 text-[10px] font-semibold text-sky-300 border border-sky-800/40 md:inline-block">
              Stage 6 Epistemic
            </span>
          </div>

          <div className="relative hidden min-w-0 flex-1 justify-center sm:flex">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            />
            <input
              data-testid="header-search-input"
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              placeholder="搜索概念、命题或关系…"
              aria-label="搜索知识库"
              className="w-full max-w-xs rounded-lg border border-white/10 bg-black/30 px-8 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            />
          </div>

          <nav aria-label="页面导航" className="flex items-center gap-4 text-xs">
            <a href="/dashboard" className="text-zinc-400 hover:text-zinc-200">
              Dashboard
            </a>
            <a href="/quests" className="text-zinc-400 hover:text-zinc-200">
              Quests
            </a>
            <a href="/skills" className="text-zinc-400 hover:text-zinc-200">
              Skill Tree
            </a>
            <a href="/knowledge" className="font-medium text-sky-400" aria-current="page">
              Knowledge Map
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex cursor-pointer items-center gap-1 text-zinc-400 transition-colors hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              title="退出登录"
            >
              <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </nav>
        </div>
      </header>

      {/* 3-Column Workspace */}
      <main className="flex min-h-0 w-full flex-1">
        {/* LEFT — Desktop Filter / Navigation Panel (280px) */}
        <aside
          className="hidden w-[280px] shrink-0 overflow-hidden border-r border-white/5 bg-[#0d1320]/60 lg:block"
          aria-label="知识领域与认识论筛选"
        >
          {filterPanel}
        </aside>

        {/* CENTER — Interactive ReactFlow Canvas */}
        <section className="relative min-w-0 flex-1" aria-label="知识图谱互动画布">
          {/* Truncation & Progressive View Indicator */}
          {graph?.stats.isTruncated && (
            <div
              data-testid="graph-truncated-banner"
              className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-[#0d1320]/90 px-3 py-1.5 text-xs text-amber-300 backdrop-blur shadow-lg"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>
                当前图谱节点较多，已截取前 {graph.nodes.length} 个核心节点（总计 {graph.stats.totalNodes}）。可点击节点进行局部展开。
              </span>
            </div>
          )}

          {loading ? (
            <div
              data-testid="loading-indicator"
              className="flex h-full items-center justify-center gap-3 text-zinc-400"
            >
              <Loader2 className="h-8 w-8 animate-spin text-sky-400" aria-hidden="true" />
              <p className="text-sm">正在加载知识图谱与认知事实…</p>
            </div>
          ) : error ? (
            <div
              data-testid="error-state"
              className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
            >
              <div className="flex items-center gap-2 text-rose-400 font-semibold">
                <AlertCircle className="h-5 w-5" />
                <span>加载知识图谱失败</span>
              </div>
              <p className="max-w-md text-sm text-zinc-400">{error}</p>
              <button
                type="button"
                data-testid="retry-btn"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> 重试
              </button>
            </div>
          ) : (graph?.stats.totalNodes ?? 0) === 0 ? (
            <div
              data-testid="empty-graph-state"
              className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
            >
              <div className="text-5xl" aria-hidden="true">
                🌐
              </div>
              <h2 className="text-xl font-semibold">知识图谱暂未生成</h2>
              <p className="max-w-md text-sm text-zinc-400">
                完成学习与实践活动后，AI 会根据真实行为推理提炼概念与命题，并在此构建结构化知识网络。
              </p>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                去记录学习活动
              </a>
            </div>
          ) : flowNodes.length === 0 ? (
            <div
              data-testid="no-match-state"
              className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
            >
              <p className="text-sm text-zinc-400">当前筛选条件下没有可见的知识节点。</p>
              <button
                type="button"
                data-testid="clear-all-filters-btn"
                onClick={handleResetFilters}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
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
              onClearSelection={handleClearSelection}
              focusTarget={focusTarget}
              fitKey={`${filters.domainId ?? "all"}|${filters.status}|${filters.nodeType}|${filters.rootNodeId ?? "no-root"}|${filters.search}|${filters.depth}`}
            />
          )}
        </section>

        {/* RIGHT — Desktop Static Column / Mobile Overlay (Node or Edge Detail) */}
        {selectedNodeId ? (
          isDesktopDetail ? (
            <aside
              className="relative hidden w-[380px] shrink-0 border-l border-white/5 bg-[#0d1320]/80 xl:block"
              aria-label="知识节点详情"
            >
              <KnowledgeDetailPanel
                key={`node-${selectedNodeId}`}
                nodeId={selectedNodeId}
                domains={domainItems}
                onClose={() => setSelectedNodeId(null)}
                onSelectNode={handleSelectNode}
                onFocusRoot={handleFocusRoot}
                onDataChanged={refresh}
              />
            </aside>
          ) : (
            <>
              <button
                type="button"
                aria-label="关闭详情面板"
                onClick={() => setSelectedNodeId(null)}
                className="fixed inset-0 z-40 bg-black/50 xl:hidden"
              />
              <div className="fixed inset-y-0 right-0 z-50 w-[min(380px,92vw)] border-l border-white/10 bg-[#0d1320] shadow-2xl xl:hidden">
                <KnowledgeDetailPanel
                  key={`drawer-node-${selectedNodeId}`}
                  nodeId={selectedNodeId}
                  domains={domainItems}
                  onClose={() => setSelectedNodeId(null)}
                  onSelectNode={handleSelectNode}
                  onFocusRoot={handleFocusRoot}
                  onDataChanged={refresh}
                />
              </div>
            </>
          )
        ) : selectedEdgeId ? (
          isDesktopDetail ? (
            <aside
              className="relative hidden w-[380px] shrink-0 border-l border-white/5 bg-[#0d1320]/80 xl:block"
              aria-label="知识连边详情"
            >
              <KnowledgeEdgeDetailPanel
                key={`edge-${selectedEdgeId}`}
                edgeId={selectedEdgeId}
                onClose={() => setSelectedEdgeId(null)}
                onSelectNode={handleSelectNode}
                onDataChanged={refresh}
              />
            </aside>
          ) : (
            <>
              <button
                type="button"
                aria-label="关闭连边详情"
                onClick={() => setSelectedEdgeId(null)}
                className="fixed inset-0 z-40 bg-black/50 xl:hidden"
              />
              <div className="fixed inset-y-0 right-0 z-50 w-[min(380px,92vw)] border-l border-white/10 bg-[#0d1320] shadow-2xl xl:hidden">
                <KnowledgeEdgeDetailPanel
                  key={`drawer-edge-${selectedEdgeId}`}
                  edgeId={selectedEdgeId}
                  onClose={() => setSelectedEdgeId(null)}
                  onSelectNode={handleSelectNode}
                  onDataChanged={refresh}
                />
              </div>
            </>
          )
        ) : null}
      </main>

      {/* Mobile Filter Drawer Overlay */}
      {mobileNavOpen && (
        <>
          <button
            type="button"
            aria-label="关闭筛选面板"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(300px,85vw)] border-r border-white/10 bg-[#0d1320] shadow-2xl lg:hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
              <span className="text-sm font-medium">知识筛选</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="关闭"
                className="rounded-md p-1 text-zinc-400 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-45px)]">{filterPanel}</div>
          </div>
        </>
      )}

      {/* Mobile Search Fallback */}
      <div className="border-t border-white/5 bg-[#0d1320]/80 px-3 py-2 sm:hidden">
        <input
          value={filters.search}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
          placeholder="搜索概念、命题或关系…"
          aria-label="搜索知识库"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        />
      </div>
    </div>
  );
}
