"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Search } from "lucide-react";
import type {
  SkillDerivedState,
  SkillFlowNode,
  SkillTreeGraphResponse,
} from "@/lib/store/types";
import DomainFilterPanel from "./components/DomainFilterPanel";
import { resolveFocusTarget } from "./components/controller";
import SkillGraphCanvas, { type CanvasFocusTarget } from "./components/SkillGraphCanvas";
import SkillDetailPanel from "./components/SkillDetailPanel";
import type { SkillFlowNodeType } from "./components/SkillNode";
import {
  buildDomainList,
  filterGraph,
} from "./components/presentation";

export default function SkillsPage() {
  const router = useRouter();
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
  const [isDesktopDetail, setIsDesktopDetail] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setIsDesktopDetail(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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
      .finally(() => setLoading(false));
  }

  const domainListItems = useMemo(
    () => buildDomainList(graph?.domains ?? [], graph?.nodes ?? []),
    [graph],
  );
  const totalCount = graph?.nodes.length ?? 0;
  const domainNameById = useMemo(
    () => new Map((graph?.domains ?? []).map((d) => [d.id, d.name])),
    [graph],
  );

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
        },
        type: "skillNode" as const,
      })),
    [visible.nodes, domainNameById],
  );

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
    <div className="flex h-full w-full min-h-0 flex-1 overflow-hidden">
      {/* LEFT — desktop */}
      <aside
        className="hidden w-[280px] shrink-0 overflow-hidden border-r border-white/5 bg-[#0d1320]/60 lg:flex lg:flex-col"
        aria-label="领域与状态筛选"
      >
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索技能名称或别名…"
              aria-label="搜索技能"
              className="w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{filterPanel}</div>
      </aside>

      {/* CENTER */}
      <section className="relative min-w-0 flex-1 h-full" aria-label="技能图谱画布">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" aria-hidden="true" />
              <p className="text-sm">正在加载技能树…</p>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="text-red-300">加载失败</div>
              <p className="max-w-md text-sm text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> 重试
              </button>
            </div>
          ) : totalCount === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="text-5xl" aria-hidden="true">
                🌱
              </div>
              <h2 className="text-xl font-semibold">还没有技能节点</h2>
              <p className="max-w-md text-sm text-zinc-400">
                完成第一次 Growth Assessment 并确认后，系统会根据真实行为建立技能树。
              </p>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                去记录成长
              </a>
            </div>
          ) : visible.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm text-zinc-400">当前筛选条件下没有可见技能。</p>
              <button
                type="button"
                onClick={() => {
                  setDomainId(null);
                  setStateFilter("all");
                  setSearch("");
                }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                清除全部筛选
              </button>
            </div>
          ) : (
            <SkillGraphCanvas
              nodes={flowNodes}
              rawEdges={visible.edges}
              onSelect={handleSelect}
              focusTarget={focusTarget}
              fitKey={`${domainId ?? "all"}|${stateFilter}|${graph ? "loaded" : "empty"}|${search === "" ? "q0" : "q1"}`}
            />
          )}
        </section>

        {/* RIGHT — desktop static column / mobile drawer (single instance) */}
        {selectedSkillId && detailOpen ? (
          isDesktopDetail ? (
            <aside
              className="relative hidden w-[380px] shrink-0 border-l border-white/5 bg-[#0d1320]/80 xl:block"
              aria-label="技能详情"
            >
              <SkillDetailPanel
                key={selectedSkillId}
                skillId={selectedSkillId}
                domains={graph?.domains ?? []}
                onClose={() => handleSelect(null)}
                onFocusSkill={handleFocusSkill}
                onChanged={refresh}
              />
            </aside>
          ) : (
            <>
              <button
                type="button"
                aria-label="关闭详情面板"
                onClick={() => handleSelect(null)}
                className="fixed inset-0 z-40 bg-black/50 xl:hidden"
              />
              <div className="fixed inset-y-0 right-0 z-50 w-[min(380px,92vw)] border-l border-white/10 bg-[#0d1320] shadow-2xl xl:hidden">
                <SkillDetailPanel
                  key={`drawer-${selectedSkillId}`}
                  skillId={selectedSkillId}
                  domains={graph?.domains ?? []}
                  onClose={() => handleSelect(null)}
                  onFocusSkill={handleFocusSkill}
                  onChanged={refresh}
                />
              </div>
            </>
          )
        ) : null}

      {/* Mobile filter overlay */}
      {mobileNavOpen ? (
        <>
          <button
            type="button"
            aria-label="关闭筛选面板"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(300px,85vw)] border-r border-white/10 bg-[#0d1320] shadow-2xl lg:hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
              <span className="text-sm font-medium">筛选</span>
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
      ) : null}

      {/* Mobile search fallback */}
      <div className="border-t border-white/5 bg-[#0d1320]/80 px-3 py-2 sm:hidden">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索技能名称或别名…"
          aria-label="搜索技能"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        />
      </div>
    </div>
  );
}
