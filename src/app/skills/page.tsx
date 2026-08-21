"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TreePine, Loader2, RefreshCw, LogOut } from "lucide-react";

interface SkillData {
  label: string;
  level: number;
  masteryLevel: number;
  masteryConfidence: number;
  xp: number;
  [key: string]: unknown;
}

interface SkillNodePayload {
  id: string;
  position: { x: number; y: number };
  data: SkillData;
}

interface SkillEdgePayload {
  id: string;
  source: string;
  target: string;
  label?: string;
}

type SkillFlowNode = Node<SkillData, "skillNode">;
type SkillFlowEdge = Edge;

function SkillNode({ data }: NodeProps<SkillFlowNode>) {
  return (
    <div className="w-44 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="text-sm font-semibold text-zinc-100">{data.label}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-amber-300">
          Lv.{data.level}
        </span>
        <span className="rounded bg-sky-400/15 px-1.5 py-0.5 font-mono text-sky-300">
          M{data.masteryLevel}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">
        {data.xp} XP · Confidence {Math.round(data.masteryConfidence * 100)}%
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}

const nodeTypes = { skillNode: SkillNode };

export default function SkillsPage() {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<SkillFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<SkillFlowEdge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load skill tree");
      const data = (await res.json()) as { nodes: SkillNodePayload[]; edges: SkillEdgePayload[] };
      setNodes(
        data.nodes.map(
          (n) =>
            ({
              id: n.id,
              position: n.position,
              data: n.data,
              type: "skillNode",
            }) as SkillFlowNode,
        ),
      );
      setEdges(
        data.edges.map(
          (e) =>
            ({
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.label,
              animated: true,
            }) as SkillFlowEdge,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [router, setNodes, setEdges]);

  useEffect(() => {
    let ignore = false;
    async function fetchSkills() {
      try {
        const res = await fetch("/api/skills");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load skill tree");
        const data = (await res.json()) as { nodes: SkillNodePayload[]; edges: SkillEdgePayload[] };
        if (ignore) return;
        setNodes(
          data.nodes.map(
            (n) =>
              ({
                id: n.id,
                position: n.position,
                data: n.data,
                type: "skillNode",
              }) as SkillFlowNode,
          ),
        );
        setEdges(
          data.edges.map(
            (e) =>
              ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                animated: true,
              }) as SkillFlowEdge,
          ),
        );
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void fetchSkills();
    return () => {
      ignore = true;
    };
  }, [router, setNodes, setEdges]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-zinc-100">
      <header className="border-b border-white/5 bg-[#0d1320]/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <TreePine className="h-5 w-5 text-emerald-300" />
            Skill Tree
          </div>
          <div className="flex items-center gap-4 text-xs">
            <a href="/dashboard" className="text-zinc-400 hover:text-zinc-200">
              Dashboard
            </a>
            <a href="/quests" className="text-zinc-400 hover:text-zinc-200">
              Quests
            </a>
            <a href="/skills" className="font-medium text-amber-300">
              Skill Tree
            </a>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
              title="退出登录"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto h-[calc(100vh-72px)] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
            <p className="text-sm">Loading skill tree…</p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="text-red-300">加载失败</div>
            <p className="max-w-md text-sm text-zinc-400">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="text-5xl">🌱</div>
            <h2 className="text-xl font-semibold">还没有技能节点</h2>
            <p className="max-w-md text-sm text-zinc-400">
              完成第一次 Growth Assessment 并确认后，系统会根据真实行为建立技能树。
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" /> 去记录成长
            </a>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            nodesConnectable={false}
            elementsSelectable
            proOptions={{ hideAttribution: false }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls />
            <MiniMap pannable zoomable className="!bg-slate-900" />
          </ReactFlow>
        )}
      </main>
    </div>
  );
}
