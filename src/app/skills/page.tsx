"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import type {
  SkillDerivedState,
  SkillFlowNode,
  SkillTreeGraphResponse,
} from "@/lib/store/types";
import DomainFilterPanel from "./components/DomainFilterPanel";
import { resolveFocusTarget } from "./components/controller";
import SkillGraphCanvas, { type CanvasFocusTarget } from "./components/SkillGraphCanvas";
import SkillDetailPanel from "./components/SkillDetailPanel";
import SkillTableView from "./components/SkillTableView";
import { InspectorDrawer } from "@/components/layout/InspectorDrawer";
import type { SkillFlowNodeType } from "./components/SkillNode";
import { findNextSkillNode, type SkillGraphDirection } from "./components/keyboard-navigation";
import {
  buildDomainList,
  filterGraph,
} from "./components/presentation";

type SkillsViewMode = "graph" | "table";

function SkillsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [graph, setGraph] = useState<SkillTreeGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [domainId, setDomainId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<SkillDerivedState | "all">("all");
  const [search, setSearch] = useState("");

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<CanvasFocusTarget | null>(null);
  const [keyboardFocusId, setKeyboardFocusId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SkillsViewMode>(() =>
    searchParams.get("view") === "table" ? "table" : "graph",
  );

  // All setStates happen after an await (react-hooks/set-state-in-effect);
  // the initial loading=true comes from useState and the refresh() event
  // handler owns the explicit loading indicators for manual reloads.
  const doFetchGraph = useCallback(async (): Promise<SkillTreeGraphResponse | null> => {
    // status=all keeps archived skills available to the explicit "已归档"
    // pill; the default canvas scope mirrors the API's active-only contract.
    const res = await fetch("/api/skills?status=all");
    if (res.status === 401) {
      router.push("/login");
      return null;
    }
    if (!res.ok) throw new Error("加载技能树失败");
    return (await res.json()) as SkillTreeGraphResponse;
  }, [router]);

  useEffect(() => {
    let ignore = false;
    doFetchGraph()
      .then((data) => {
        if (!ignore && data) setGraph(data);
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

  const domainListItems = useMemo(() => {
    if (!graph) return [];
    return buildDomainList(graph.domains, graph.nodes);
  }, [graph]);

  const domainNameById = useMemo(() => {
    if (!graph) return new Map<string, string>();
    return new Map(graph.domains.map((d) => [d.id, d.name]));
  }, [graph]);

  const totalCount = graph?.nodes?.length ?? 0;

  const visible = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return filterGraph(graph, { domainId, stateFilter, search });
  }, [graph, domainId, stateFilter, search]);

  const flowNodes: SkillFlowNodeType[] = useMemo(
    () =>
      visible.nodes.map((node: SkillFlowNode) => ({
        id: node.id,
        position: node.position,
        data: {
          ...node.data,
          domainLabel: node.domainId ? domainNameById.get(node.domainId) ?? null : null,
          isSelected: selectedSkillId === node.id,
        },
        type: "skillNode" as const,
      })),
    [visible.nodes, domainNameById, selectedSkillId],
  );

  const handleNavigateSkill = useCallback(
    (skillId: string, direction: SkillGraphDirection) => {
      const nextId = findNextSkillNode(skillId, direction, visible.nodes, visible.edges);
      if (!nextId) return;

      setKeyboardFocusId(nextId);
      const target = visible.nodes.find((node) => node.id === nextId);
      if (target?.position) {
        setFocusTarget((previous) => ({
          x: target.position.x,
          y: target.position.y,
          nonce: (previous?.nonce ?? 0) + 1,
        }));
      }
    },
    [visible.edges, visible.nodes],
  );

  useEffect(() => {
    if (!keyboardFocusId || viewMode !== "graph") return;
    document.getElementById(`skill-graph-node-${keyboardFocusId}`)?.focus();
  }, [flowNodes, keyboardFocusId, viewMode]);

  function updateViewMode(nextMode: SkillsViewMode) {
    setViewMode(nextMode);
    router.replace(nextMode === "table" ? "/skills?view=table" : "/skills", { scroll: false });
  }

  function handleSelect(skillId: string | null) {
    if (!skillId) {
      setSelectedSkillId(null);
      setDetailOpen(false);
      return;
    }
    setSelectedSkillId(skillId);
    setDetailOpen(true);
  }

  /**
   * Focus a skill from panels/search: relax viewport filters so the target is
   * visible. Archived skills are hidden under "all", so they require the
   * explicit "archived" pill (P1-1 regression fix); active skills use "all".
   */
  function handleFocusSkill(skillId: string) {
    const focus = resolveFocusTarget(graph?.nodes ?? [], skillId);
    setDomainId(null);
    setStateFilter(focus.stateFilter);
    setSearch("");
    setSelectedSkillId(skillId);
    setDetailOpen(true);
    if (focus.position) {
      setFocusTarget({ x: focus.position.x, y: focus.position.y, nonce: Date.now() });
    }
  }

  const filterPanel = (
    <DomainFilterPanel
      domains={domainListItems}
      totalCount={totalCount}
      activeDomainId={domainId}
      onSelectDomain={setDomainId}
      stateFilter={stateFilter}
      onSelectState={setStateFilter}
    />
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--header-height)-var(--mobile-nav-height))] w-full min-h-0 overflow-hidden md:h-[calc(100dvh-var(--header-height))]">
      <h2 className="sr-only">技能图谱能力网络</h2>

      {/* Mobile/Tablet Local Toolbar (below lg) */}
      <div className="flex items-center justify-between gap-2 p-2.5 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="打开筛选面板"
          aria-expanded={mobileNavOpen}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          <span>筛选</span>
        </button>

        <div className="relative flex-1 max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能…"
            aria-label="搜索技能"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] pl-8 pr-2.5 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
          />
        </div>
      </div>

      {/* Mobile Inline Collapsible Filter Panel (Zero raw z-index overlay) */}
      {mobileNavOpen ? (
        <div className="lg:hidden border-b border-[var(--border-subtle)] bg-[var(--surface-base)] max-h-80 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)] mb-2">
            <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">筛选选项</span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              aria-label="关闭筛选面板"
            >
              ✕
            </button>
          </div>
          {filterPanel}
        </div>
      ) : null}

      {/* Main Workspace Row */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* LEFT — Desktop Filter / Navigation Panel (280px) */}
        <aside
          className="hidden w-[var(--sidebar-width-expanded)] shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-base)] lg:flex lg:flex-col"
          aria-label="领域与状态筛选"
        >
          <div className="p-3 border-b border-[var(--border-subtle)]">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索技能名称或别名…"
                aria-label="搜索技能"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] pl-8 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{filterPanel}</div>
        </aside>

        {/* CENTER — Interactive Canvas */}
        <section
          className="relative min-w-0 flex-1 h-full"
          aria-label={viewMode === "table" ? "技能表格视图" : "技能图谱画布"}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <span>技能节点：{visible.nodes.length}</span>
            <button
              type="button"
              aria-pressed={viewMode === "table"}
              onClick={() => updateViewMode(viewMode === "table" ? "graph" : "table")}
              className="min-h-[var(--touch-target-min)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            >
              {viewMode === "table" ? "切换图谱" : "切换表格"}
            </button>
          </div>
          {loading ? (
            <div className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]" role="status" aria-busy="true" aria-label="正在加载技能树">
              <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none text-[var(--text-muted)]" aria-hidden="true" />
              <p className="text-sm">正在加载技能树…</p>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="text-[var(--state-danger-text)] font-semibold">加载失败</div>
              <p className="max-w-md text-sm text-[var(--text-muted)]">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> 重试
              </button>
            </div>
          ) : totalCount === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="text-5xl" aria-hidden="true">
                🌱
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">还没有技能节点</h3>
              <p className="max-w-md text-sm text-[var(--text-muted)]">
                完成第一次 Growth Assessment 并确认后，系统会根据真实行为建立技能树。
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              >
                去记录成长
              </Link>
            </div>
          ) : visible.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">当前筛选条件下没有可见技能。</p>
              <button
                type="button"
                onClick={() => {
                  setDomainId(null);
                  setStateFilter("all");
                  setSearch("");
                }}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              >
                清除全部筛选
              </button>
            </div>
          ) : viewMode === "table" ? (
            <SkillTableView nodes={flowNodes} edges={visible.edges} onSelect={handleSelect} />
          ) : (
            <SkillGraphCanvas
              nodes={flowNodes}
              rawEdges={visible.edges}
              onSelect={handleSelect}
              onNavigate={handleNavigateSkill}
              focusTarget={focusTarget}
              fitKey={`${domainId ?? "all"}|${stateFilter}|${graph ? "loaded" : "empty"}|${search === "" ? "q0" : "q1"}`}
            />
          )}
        </section>

        {/* RIGHT — Global InspectorDrawer Integration (Responsive single-instance: desktop static column on xl, overlay on < xl: xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0 xl:hidden xl:static) */}
        <InspectorDrawer
          open={Boolean(selectedSkillId && detailOpen)}
          onClose={() => handleSelect(null)}
          title="技能全景档案"
          mode="auto"
          className="xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0"
        >
          {selectedSkillId ? (
            <SkillDetailPanel
              key={selectedSkillId}
              skillId={selectedSkillId}
              domains={graph?.domains ?? []}
              onClose={() => handleSelect(null)}
              onFocusSkill={handleFocusSkill}
              onChanged={refresh}
            />
          ) : null}
        </InspectorDrawer>
      </div>
    </div>
  );
}

export default function SkillsPage() {
  return (
    <Suspense fallback={<div role="status" aria-label="正在加载技能视图" />}>
      <SkillsPageContent />
    </Suspense>
  );
}
