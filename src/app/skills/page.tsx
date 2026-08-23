"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Menu, RefreshCw, Search, TreePine } from "lucide-react";
import type {
  SkillDerivedState,
  SkillFlowNode,
  SkillTreeGraphResponse,
} from "@/lib/store/types";
import DomainFilterPanel from "./components/DomainFilterPanel";
import SkillGraphCanvas, { type CanvasFocusTarget } from "./components/SkillGraphCanvas";
import SkillDetailPanel from "./components/SkillDetailPanel";
import type { SkillFlowNodeType } from "./components/SkillNode";
import {
  buildDomainList,
  filterGraph,
  findNodeById,
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

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // status=all keeps archived skills available to the explicit "已归档"
      // pill; the default canvas scope mirrors the API's active-only contract.
      const res = await fetch("/api/skills?status=all");
      if (res.status === 401) {
        router.push("/login");
        return false;
      }
      if (!res.ok) throw new Error("加载技能树失败");
      setGraph((await res.json()) as SkillTreeGraphResponse);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知错误");
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

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

  /** Focus a skill from panels/search: relax viewport filters so it is visible. */
  function handleFocusSkill(skillId: string) {
    const node = findNodeById(graph?.nodes ?? [], skillId);
    setDomainId(null);
    setStateFilter("all");
    setSearch("");
    setSelectedSkillId(skillId);
    setDetailOpen(true);
    if (node) {
      setFocusTarget({ x: node.position.x, y: node.position.y, nonce: Date.now() });
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0f17] text-zinc-100">
      {/* Header */}
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
            <TreePine aria-hidden="true" className="h-5 w-5 text-emerald-300" />
            Skill Tree
          </div>

          <div className="relative hidden min-w-0 flex-1 justify-center sm:flex">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索技能名称或别名…"
              aria-label="搜索技能"
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
            <a href="/skills" className="font-medium text-amber-300" aria-current="page">
              Skill Tree
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

      {/* 3-column workspace */}
      <main className="flex min-h-0 w-full flex-1">
        {/* LEFT — desktop */}
        <aside
          className="hidden w-[280px] shrink-0 overflow-hidden border-r border-white/5 bg-[#0d1320]/60 lg:block"
          aria-label="领域与状态筛选"
        >
          {filterPanel}
        </aside>

        {/* CENTER */}
        <section className="relative min-w-0 flex-1" aria-label="技能图谱画布">
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
                onClick={() => void load()}
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
              selectedId={selectedSkillId}
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
                onChanged={() => void load()}
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
                  onChanged={() => void load()}
                />
              </div>
            </>
          )
        ) : null}
      </main>

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
