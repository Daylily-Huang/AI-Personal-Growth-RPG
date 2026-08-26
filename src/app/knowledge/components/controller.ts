// src/app/knowledge/components/controller.ts
// Stage 6C Knowledge Map State & API Communication Controller

import type {
  KnowledgeNodeType,
  KnowledgeGraphResponse,
  KnowledgeNodeDetailResponse,
  KnowledgeEdgeDetailResponse,
  UpdateKnowledgeNodeInput,
} from "@/lib/knowledge/types";

export interface KnowledgeFilters {
  domainId: string | null;
  status: "all" | "verified" | "inferred" | "archived";
  nodeType: KnowledgeNodeType | "all";
  search: string;
  rootNodeId: string | null;
  depth: number;
  limit: number;
}

export const DEFAULT_FILTERS: KnowledgeFilters = {
  domainId: null,
  status: "all",
  nodeType: "all",
  search: "",
  rootNodeId: null,
  depth: 1,
  limit: 60,
};

export function buildGraphQueryUrl(filters: KnowledgeFilters): string {
  const params = new URLSearchParams();

  if (filters.domainId) {
    params.set("domainId", filters.domainId);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.nodeType !== "all") {
    params.set("nodeType", filters.nodeType);
  }
  if (filters.search.trim().length > 0) {
    params.set("search", filters.search.trim());
  }
  if (filters.rootNodeId) {
    params.set("rootNodeId", filters.rootNodeId);
    params.set("depth", String(filters.depth));
  }
  if (filters.limit !== 60) {
    params.set("limit", String(filters.limit));
  }

  const qs = params.toString();
  return qs ? `/api/knowledge?${qs}` : "/api/knowledge";
}

export async function fetchKnowledgeGraph(
  filters: KnowledgeFilters,
): Promise<{ data: KnowledgeGraphResponse | null; error: string | null; status: number }> {
  try {
    const url = buildGraphQueryUrl(filters);
    const res = await fetch(url);
    if (res.status === 401) {
      return { data: null, error: "未登录或登录会话已过期", status: 401 };
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        data: null,
        error: errJson.error || `请求失败 (${res.status})`,
        status: res.status,
      };
    }
    const data = (await res.json()) as KnowledgeGraphResponse;
    return { data, error: null, status: 200 };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}

export async function fetchNodeDetail(
  nodeId: string,
): Promise<{ data: KnowledgeNodeDetailResponse | null; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api/knowledge/${nodeId}`);
    if (res.status === 401) {
      return { data: null, error: "未登录或登录会话已过期", status: 401 };
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        data: null,
        error: errJson.error || `获取节点详情失败 (${res.status})`,
        status: res.status,
      };
    }
    const data = (await res.json()) as KnowledgeNodeDetailResponse;
    return { data, error: null, status: 200 };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}

export async function fetchEdgeDetail(
  edgeId: string,
): Promise<{ data: KnowledgeEdgeDetailResponse | null; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api/knowledge/edges/${edgeId}`);
    if (res.status === 401) {
      return { data: null, error: "未登录或登录会话已过期", status: 401 };
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        data: null,
        error: errJson.error || `获取连边详情失败 (${res.status})`,
        status: res.status,
      };
    }
    const data = (await res.json()) as KnowledgeEdgeDetailResponse;
    return { data, error: null, status: 200 };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}

export async function verifyKnowledgeNode(
  nodeId: string,
): Promise<{ success: boolean; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api/knowledge/${nodeId}/verify`, { method: "POST" });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `验证节点失败 (${res.status})`,
        status: res.status,
      };
    }
    return { success: true, error: null, status: 200 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}

export async function rejectKnowledgeNode(
  nodeId: string,
): Promise<{ success: boolean; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api/knowledge/${nodeId}/reject`, { method: "POST" });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `否决节点失败 (${res.status})`,
        status: res.status,
      };
    }
    return { success: true, error: null, status: 200 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}

export async function verifyKnowledgeEdge(
  edgeId: string,
): Promise<{ success: boolean; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api/knowledge/edges/${edgeId}/verify`, { method: "POST" });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `验证连边失败 (${res.status})`,
        status: res.status,
      };
    }
    return { success: true, error: null, status: 200 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}

export async function rejectKnowledgeEdge(
  edgeId: string,
): Promise<{ success: boolean; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api/knowledge/edges/${edgeId}/reject`, { method: "POST" });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `否决连边失败 (${res.status})`,
        status: res.status,
      };
    }
    return { success: true, error: null, status: 200 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}

export async function updateKnowledgeNodeMetadata(
  nodeId: string,
  input: UpdateKnowledgeNodeInput,
): Promise<{ success: boolean; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api/knowledge/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `更新元数据失败 (${res.status})`,
        status: res.status,
      };
    }
    return { success: true, error: null, status: 200 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "网络连接异常",
      status: 0,
    };
  }
}
