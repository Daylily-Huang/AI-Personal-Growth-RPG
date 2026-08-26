// src/lib/store/knowledge-repository.ts
// Stage 6B Knowledge Map Repository Implementation with strict tenant isolation & DB RPC authority

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthRequiredError } from "./request-repository";
import {
  NotFoundError,
  InvalidAuthorityTransitionError,
} from "@/lib/knowledge/authority-service";
import type {
  KnowledgeNode,
  KnowledgeEdge,
  CreateKnowledgeNodeInput,
  UpdateKnowledgeNodeInput,
  CreateKnowledgeEdgeInput,
  KnowledgeNodeDetailResponse,
  KnowledgeEdgeDetailResponse,
  KnowledgeNodeType,
  KnowledgeVerificationStatus,
  KnowledgeSourceType,
  KnowledgeRelationType,
} from "@/lib/knowledge/types";

export interface KnowledgeRepository {
  readonly userId: string;

  getNode(nodeId: string): Promise<KnowledgeNode | null>;
  listNodes(filter?: {
    domainId?: string | null;
    status?: string;
    nodeType?: string;
    search?: string;
  }): Promise<KnowledgeNode[]>;
  createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode>;
  updateNodeMetadata(
    nodeId: string,
    updates: UpdateKnowledgeNodeInput,
  ): Promise<KnowledgeNode>;
  deleteNode(nodeId: string): Promise<boolean>;

  getEdge(edgeId: string): Promise<KnowledgeEdge | null>;
  listEdges(filter?: {
    domainId?: string | null;
    status?: string;
    relationType?: string;
  }): Promise<KnowledgeEdge[]>;
  createEdge(input: CreateKnowledgeEdgeInput): Promise<KnowledgeEdge>;
  deleteEdge(edgeId: string): Promise<boolean>;

  getNodeDetail(nodeId: string): Promise<KnowledgeNodeDetailResponse | null>;
  getEdgeDetail(edgeId: string): Promise<KnowledgeEdgeDetailResponse | null>;

  applyNodeAuthorityTransition(
    nodeId: string,
    transition: "verify" | "reject",
  ): Promise<KnowledgeNode>;
  applyEdgeAuthorityTransition(
    edgeId: string,
    transition: "verify" | "reject",
  ): Promise<KnowledgeEdge>;
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    readonly userId: string,
  ) {}

  private mapNodeRow(
    row: Tables<"knowledge_nodes">,
    domainName?: string | null,
    skillName?: string | null,
  ): KnowledgeNode {
    return {
      id: row.id,
      userId: row.user_id,
      domainId: row.domain_id,
      domainName: domainName ?? null,
      skillId: row.skill_id,
      skillName: skillName ?? null,
      nodeType: row.node_type as KnowledgeNodeType,
      title: row.title,
      normalizedTitle: row.normalized_title,
      description: row.description,
      verificationStatus: row.verification_status as KnowledgeVerificationStatus,
      confidence: Number(row.confidence),
      sourceType: row.source_type as KnowledgeSourceType,
      sourceId: row.source_id,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      isArchived: row.is_archived,
      archivedAt: row.archived_at,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      lastReviewedAt: row.last_reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEdgeRow(
    row: Tables<"knowledge_edges">,
    sourceTitle?: string,
    sourceType?: KnowledgeNodeType,
    targetTitle?: string,
    targetType?: KnowledgeNodeType,
  ): KnowledgeEdge {
    return {
      id: row.id,
      userId: row.user_id,
      sourceNodeId: row.source_node_id,
      sourceNodeTitle: sourceTitle,
      sourceNodeType: sourceType,
      targetNodeId: row.target_node_id,
      targetNodeTitle: targetTitle,
      targetNodeType: targetType,
      relationType: row.relation_type as KnowledgeRelationType,
      verificationStatus: row.verification_status as KnowledgeVerificationStatus,
      confidence: Number(row.confidence),
      sourceType: row.source_type as KnowledgeSourceType,
      sourceId: row.source_id,
      provenanceNote: row.provenance_note,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      isArchived: row.is_archived,
      archivedAt: row.archived_at,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getNode(nodeId: string): Promise<KnowledgeNode | null> {
    const { data, error } = await this.client
      .from("knowledge_nodes")
      .select("*")
      .eq("id", nodeId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapNodeRow(data);
  }

  async listNodes(filter?: {
    domainId?: string | null;
    status?: string;
    nodeType?: string;
    search?: string;
  }): Promise<KnowledgeNode[]> {
    let query = this.client
      .from("knowledge_nodes")
      .select("*")
      .eq("user_id", this.userId);

    if (filter?.domainId) {
      query = query.eq("domain_id", filter.domainId);
    }

    if (filter?.nodeType) {
      query = query.eq("node_type", filter.nodeType);
    }

    if (filter?.search && filter.search.trim().length > 0) {
      query = query.ilike("title", `%${filter.search.trim()}%`);
    }

    if (filter?.status === "archived") {
      query = query.eq("is_archived", true);
    } else if (filter?.status === "verified") {
      query = query.eq("verification_status", "verified").eq("is_archived", false);
    } else if (filter?.status === "inferred") {
      query = query.eq("verification_status", "inferred").eq("is_archived", false);
    } else if (filter?.status === "any") {
      // Fetch entire tenant node universe (e.g. for root ego-graph traversal)
    } else if (filter?.status === "all" || !filter?.status) {
      query = query
        .in("verification_status", ["inferred", "verified"])
        .eq("is_archived", false);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((r) => this.mapNodeRow(r));
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const isAiProposal = input.sourceType === "ai_proposal";
    const now = new Date().toISOString();

    const insertPayload: TablesInsert<"knowledge_nodes"> = {
      user_id: this.userId,
      node_type: input.nodeType ?? "concept",
      title: input.title,
      description: input.description ?? null,
      domain_id: input.domainId ?? null,
      skill_id: input.skillId ?? null,
      source_type: input.sourceType ?? "user_created",
      source_id: input.sourceId ?? null,
      verification_status: isAiProposal ? "inferred" : "verified",
      confidence: isAiProposal
        ? Math.min(input.confidence ?? 0.8, 0.95)
        : 1.0,
      verified_at: isAiProposal ? null : now,
      verified_by: isAiProposal ? null : this.userId,
      is_archived: false,
      metadata: (input.metadata ?? {}) as Database["public"]["Tables"]["knowledge_nodes"]["Insert"]["metadata"],
    };

    const { data, error } = await this.client
      .from("knowledge_nodes")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapNodeRow(data);
  }

  async updateNodeMetadata(
    nodeId: string,
    updates: UpdateKnowledgeNodeInput,
  ): Promise<KnowledgeNode> {
    const updatePayload: TablesUpdate<"knowledge_nodes"> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.domainId !== undefined) updatePayload.domain_id = updates.domainId;
    if (updates.skillId !== undefined) updatePayload.skill_id = updates.skillId;
    if (updates.metadata !== undefined) {
      updatePayload.metadata = updates.metadata as Database["public"]["Tables"]["knowledge_nodes"]["Update"]["metadata"];
    }
    if (updates.isArchived !== undefined) {
      updatePayload.is_archived = updates.isArchived;
      updatePayload.archived_at = updates.isArchived ? new Date().toISOString() : null;
    }

    const { data, error } = await this.client
      .from("knowledge_nodes")
      .update(updatePayload)
      .eq("id", nodeId)
      .eq("user_id", this.userId)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundError("Knowledge node not found");
    return this.mapNodeRow(data);
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("knowledge_nodes")
      .delete()
      .eq("id", nodeId)
      .eq("user_id", this.userId)
      .select("id");

    if (error) throw new Error(error.message);
    return Boolean(data && data.length > 0);
  }

  async getEdge(edgeId: string): Promise<KnowledgeEdge | null> {
    const { data, error } = await this.client
      .from("knowledge_edges")
      .select("*")
      .eq("id", edgeId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapEdgeRow(data);
  }

  async listEdges(filter?: {
    domainId?: string | null;
    status?: string;
    relationType?: string;
  }): Promise<KnowledgeEdge[]> {
    let query = this.client
      .from("knowledge_edges")
      .select("*")
      .eq("user_id", this.userId);

    if (filter?.relationType) {
      query = query.eq("relation_type", filter.relationType);
    }

    if (filter?.status === "archived") {
      query = query.eq("is_archived", true);
    } else if (filter?.status === "verified") {
      query = query.eq("verification_status", "verified").eq("is_archived", false);
    } else if (filter?.status === "inferred") {
      query = query.eq("verification_status", "inferred").eq("is_archived", false);
    } else if (filter?.status === "any") {
      // Fetch entire tenant edge universe
    } else if (filter?.status === "all" || !filter?.status) {
      query = query
        .in("verification_status", ["inferred", "verified"])
        .eq("is_archived", false);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((r) => this.mapEdgeRow(r));
  }

  async createEdge(input: CreateKnowledgeEdgeInput): Promise<KnowledgeEdge> {
    let sourceId = input.sourceNodeId;
    let targetId = input.targetNodeId;

    // Deterministic Canonicalization for Symmetric Relations (P1-3)
    if (input.relationType === "contradicts" || input.relationType === "relates_to") {
      if (sourceId > targetId) {
        sourceId = input.targetNodeId;
        targetId = input.sourceNodeId;
      }
    }

    const isAiProposal = input.sourceType === "ai_proposal";
    const now = new Date().toISOString();

    const insertPayload: TablesInsert<"knowledge_edges"> = {
      user_id: this.userId,
      source_node_id: sourceId,
      target_node_id: targetId,
      relation_type: input.relationType,
      source_type: input.sourceType ?? "user_created",
      source_id: input.sourceId ?? null,
      provenance_note: input.provenanceNote ?? null,
      verification_status: isAiProposal ? "inferred" : "verified",
      confidence: isAiProposal
        ? Math.min(input.confidence ?? 0.8, 0.95)
        : 1.0,
      verified_at: isAiProposal ? null : now,
      verified_by: isAiProposal ? null : this.userId,
      is_archived: false,
      metadata: (input.metadata ?? {}) as Database["public"]["Tables"]["knowledge_edges"]["Insert"]["metadata"],
    };

    const { data, error } = await this.client
      .from("knowledge_edges")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapEdgeRow(data);
  }

  async deleteEdge(edgeId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("knowledge_edges")
      .delete()
      .eq("id", edgeId)
      .eq("user_id", this.userId)
      .select("id");

    if (error) throw new Error(error.message);
    return Boolean(data && data.length > 0);
  }

  async getNodeDetail(nodeId: string): Promise<KnowledgeNodeDetailResponse | null> {
    // 1. Fetch node
    const { data: nodeData, error: nodeError } = await this.client
      .from("knowledge_nodes")
      .select("*")
      .eq("id", nodeId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (nodeError || !nodeData) return null;

    // 2. Fetch Domain and Skill labels (tenant-safe)
    let domainName: string | null = null;
    let skillName: string | null = null;

    if (nodeData.domain_id) {
      const { data: dData } = await this.client
        .from("domains")
        .select("name")
        .eq("id", nodeData.domain_id)
        .eq("user_id", this.userId)
        .maybeSingle();
      domainName = dData?.name ?? null;
    }

    if (nodeData.skill_id) {
      const { data: sData } = await this.client
        .from("skills")
        .select("name")
        .eq("id", nodeData.skill_id)
        .eq("user_id", this.userId)
        .maybeSingle();
      skillName = sData?.name ?? null;
    }

    // 3. Resolve Provenance Activity / Artifact / Evidence
    let sourceActivity: KnowledgeNodeDetailResponse["provenance"]["sourceActivity"] = null;
    let sourceArtifact: KnowledgeNodeDetailResponse["provenance"]["sourceArtifact"] = null;

    if (
      (nodeData.source_type === "activity" || nodeData.source_type === "ai_proposal") &&
      nodeData.source_id
    ) {
      const { data: actData } = await this.client
        .from("activities")
        .select("id, title, activity_type, created_at")
        .eq("id", nodeData.source_id)
        .eq("user_id", this.userId)
        .maybeSingle();

      if (actData) {
        sourceActivity = {
          id: actData.id,
          title: actData.title,
          activityType: actData.activity_type ?? "activity",
          completedAt: actData.created_at,
        };
      }
    }

    if (nodeData.source_type === "artifact" && nodeData.source_id) {
      const { data: artData } = await this.client
        .from("artifacts")
        .select("id, title, artifact_type")
        .eq("id", nodeData.source_id)
        .eq("user_id", this.userId)
        .maybeSingle();

      if (artData) {
        sourceArtifact = {
          id: artData.id,
          title: artData.title,
          type: artData.artifact_type ?? "document",
        };
      }
    }

    const { data: evidenceRows } = await this.client
      .from("evidence_records")
      .select("id, evidence_type, description, verified, created_at")
      .eq("knowledge_node_id", nodeId)
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    const evidenceRecords = (evidenceRows ?? []).map((e) => ({
      id: e.id,
      type: e.evidence_type ?? "E0",
      content: e.description ?? "",
      verified: e.verified,
      createdAt: e.created_at,
    }));

    // 4. Resolve Inbound & Outbound Connections
    const { data: inEdges } = await this.client
      .from("knowledge_edges")
      .select("*, source_node:knowledge_nodes!fk_knowledge_edges_source_tenant_safe(title, node_type)")
      .eq("target_node_id", nodeId)
      .eq("user_id", this.userId);

    const { data: outEdges } = await this.client
      .from("knowledge_edges")
      .select("*, target_node:knowledge_nodes!fk_knowledge_edges_target_tenant_safe(title, node_type)")
      .eq("source_node_id", nodeId)
      .eq("user_id", this.userId);

    const inbound = (inEdges ?? []).map((e) => {
      const src = e.source_node as unknown as { title: string; node_type: string } | null;
      return {
        edgeId: e.id,
        sourceNodeId: e.source_node_id,
        sourceNodeTitle: src?.title ?? "Unknown",
        sourceNodeType: src?.node_type ?? "concept",
        relationType: e.relation_type,
        verificationStatus: e.verification_status,
        confidence: Number(e.confidence),
        sourceType: e.source_type,
        sourceId: e.source_id,
        provenanceNote: e.provenance_note,
      };
    });

    const outbound = (outEdges ?? []).map((e) => {
      const tgt = e.target_node as unknown as { title: string; node_type: string } | null;
      return {
        edgeId: e.id,
        targetNodeId: e.target_node_id,
        targetNodeTitle: tgt?.title ?? "Unknown",
        targetNodeType: tgt?.node_type ?? "concept",
        relationType: e.relation_type,
        verificationStatus: e.verification_status,
        confidence: Number(e.confidence),
        sourceType: e.source_type,
        sourceId: e.source_id,
        provenanceNote: e.provenance_note,
      };
    });

    return {
      node: {
        id: nodeData.id,
        title: nodeData.title,
        description: nodeData.description,
        nodeType: nodeData.node_type as KnowledgeNodeType,
        domainId: nodeData.domain_id,
        domainName,
        skillId: nodeData.skill_id,
        skillName,
        verificationStatus: nodeData.verification_status as KnowledgeVerificationStatus,
        isArchived: nodeData.is_archived,
        confidence: Number(nodeData.confidence),
        sourceType: nodeData.source_type as KnowledgeSourceType,
        sourceId: nodeData.source_id,
        verifiedAt: nodeData.verified_at,
        verifiedBy: nodeData.verified_by,
        metadata: (nodeData.metadata as Record<string, unknown>) ?? {},
        lastReviewedAt: nodeData.last_reviewed_at,
        createdAt: nodeData.created_at,
        updatedAt: nodeData.updated_at,
      },
      provenance: {
        sourceActivity,
        sourceArtifact,
        evidenceRecords,
      },
      connections: {
        inbound,
        outbound,
      },
    };
  }

  async getEdgeDetail(edgeId: string): Promise<KnowledgeEdgeDetailResponse | null> {
    const { data: edgeData, error } = await this.client
      .from("knowledge_edges")
      .select("*, source_node:knowledge_nodes!fk_knowledge_edges_source_tenant_safe(title), target_node:knowledge_nodes!fk_knowledge_edges_target_tenant_safe(title)")
      .eq("id", edgeId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error || !edgeData) return null;

    const src = edgeData.source_node as unknown as { title: string } | null;
    const tgt = edgeData.target_node as unknown as { title: string } | null;

    let sourceActivity: KnowledgeEdgeDetailResponse["provenance"]["sourceActivity"] = null;
    let sourceArtifact: KnowledgeEdgeDetailResponse["provenance"]["sourceArtifact"] = null;

    if (
      (edgeData.source_type === "activity" || edgeData.source_type === "ai_proposal") &&
      edgeData.source_id
    ) {
      const { data: actData } = await this.client
        .from("activities")
        .select("id, title, created_at")
        .eq("id", edgeData.source_id)
        .eq("user_id", this.userId)
        .maybeSingle();

      if (actData) {
        sourceActivity = {
          id: actData.id,
          title: actData.title,
          completedAt: actData.created_at,
        };
      }
    }

    if (edgeData.source_type === "artifact" && edgeData.source_id) {
      const { data: artData } = await this.client
        .from("artifacts")
        .select("id, title, artifact_type")
        .eq("id", edgeData.source_id)
        .eq("user_id", this.userId)
        .maybeSingle();

      if (artData) {
        sourceArtifact = {
          id: artData.id,
          title: artData.title,
          type: artData.artifact_type ?? "document",
        };
      }
    }

    return {
      edge: {
        id: edgeData.id,
        sourceNodeId: edgeData.source_node_id,
        sourceNodeTitle: src?.title ?? "Unknown",
        targetNodeId: edgeData.target_node_id,
        targetNodeTitle: tgt?.title ?? "Unknown",
        relationType: edgeData.relation_type as KnowledgeRelationType,
        verificationStatus: edgeData.verification_status as KnowledgeVerificationStatus,
        confidence: Number(edgeData.confidence),
        isArchived: edgeData.is_archived,
        sourceType: edgeData.source_type as KnowledgeSourceType,
        sourceId: edgeData.source_id,
        provenanceNote: edgeData.provenance_note,
        verifiedAt: edgeData.verified_at,
        verifiedBy: edgeData.verified_by,
        createdAt: edgeData.created_at,
        updatedAt: edgeData.updated_at,
      },
      provenance: {
        sourceActivity,
        sourceArtifact,
      },
    };
  }

  async applyNodeAuthorityTransition(
    nodeId: string,
    transition: "verify" | "reject",
  ): Promise<KnowledgeNode> {
    const rpcName = transition === "verify" ? "verify_knowledge_node" : "reject_knowledge_node";
    const { data, error } = await this.client.rpc(rpcName, { p_node_id: nodeId });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("node_not_found") || error.code === "P0002") {
        throw new NotFoundError(`Knowledge node ${nodeId} not found`);
      }
      if (msg.includes("invalid_authority_transition") || error.code === "22000") {
        throw new InvalidAuthorityTransitionError(
          `Cannot ${transition} node: node is not in inferred state or transition lost concurrent race`,
        );
      }
      if (msg.includes("auth_required") || error.code === "28000") {
        throw new AuthRequiredError();
      }
      throw new Error(error.message);
    }

    if (!data) {
      throw new NotFoundError(`Knowledge node ${nodeId} not found`);
    }

    return this.mapNodeRow(data as unknown as Tables<"knowledge_nodes">);
  }

  async applyEdgeAuthorityTransition(
    edgeId: string,
    transition: "verify" | "reject",
  ): Promise<KnowledgeEdge> {
    const rpcName = transition === "verify" ? "verify_knowledge_edge" : "reject_knowledge_edge";
    const { data, error } = await this.client.rpc(rpcName, { p_edge_id: edgeId });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("edge_not_found") || error.code === "P0002") {
        throw new NotFoundError(`Knowledge edge ${edgeId} not found`);
      }
      if (msg.includes("invalid_authority_transition") || error.code === "22000") {
        throw new InvalidAuthorityTransitionError(
          `Cannot ${transition} edge: edge is not in inferred state or transition lost concurrent race`,
        );
      }
      if (msg.includes("auth_required") || error.code === "28000") {
        throw new AuthRequiredError();
      }
      throw new Error(error.message);
    }

    if (!data) {
      throw new NotFoundError(`Knowledge edge ${edgeId} not found`);
    }

    return this.mapEdgeRow(data as unknown as Tables<"knowledge_edges">);
  }
}

/** Demo fallback in-memory Knowledge Repository for local non-Supabase dev */
export class DemoKnowledgeRepository implements KnowledgeRepository {
  readonly userId = "00000000-0000-4000-a000-000000000001";
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();

  async getNode(nodeId: string): Promise<KnowledgeNode | null> {
    const n = this.nodes.get(nodeId);
    return n && n.userId === this.userId ? n : null;
  }

  async listNodes(filter?: {
    domainId?: string | null;
    status?: string;
    nodeType?: string;
    search?: string;
  }): Promise<KnowledgeNode[]> {
    let list = Array.from(this.nodes.values()).filter((n) => n.userId === this.userId);
    if (filter?.domainId) list = list.filter((n) => n.domainId === filter.domainId);
    if (filter?.nodeType) list = list.filter((n) => n.nodeType === filter.nodeType);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q));
    }
    if (filter?.status === "archived") {
      list = list.filter((n) => n.isArchived);
    } else if (filter?.status === "verified") {
      list = list.filter((n) => n.verificationStatus === "verified" && !n.isArchived);
    } else if (filter?.status === "inferred") {
      list = list.filter((n) => n.verificationStatus === "inferred" && !n.isArchived);
    } else if (filter?.status === "any") {
      // Entire universe
    } else {
      list = list.filter(
        (n) => (n.verificationStatus === "inferred" || n.verificationStatus === "verified") && !n.isArchived,
      );
    }
    return list;
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isAi = input.sourceType === "ai_proposal";
    const node: KnowledgeNode = {
      id,
      userId: this.userId,
      domainId: input.domainId ?? null,
      skillId: input.skillId ?? null,
      nodeType: input.nodeType ?? "concept",
      title: input.title,
      normalizedTitle: input.title.trim().toLowerCase(),
      description: input.description ?? null,
      verificationStatus: isAi ? "inferred" : "verified",
      confidence: isAi ? Math.min(input.confidence ?? 0.8, 0.95) : 1.0,
      sourceType: input.sourceType ?? "user_created",
      sourceId: input.sourceId ?? null,
      verifiedAt: isAi ? null : now,
      verifiedBy: isAi ? null : this.userId,
      isArchived: false,
      archivedAt: null,
      metadata: input.metadata ?? {},
      lastReviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.nodes.set(id, node);
    return node;
  }

  async updateNodeMetadata(
    nodeId: string,
    updates: UpdateKnowledgeNodeInput,
  ): Promise<KnowledgeNode> {
    const existing = await this.getNode(nodeId);
    if (!existing) throw new NotFoundError("Knowledge node not found");
    const updated: KnowledgeNode = {
      ...existing,
      title: updates.title ?? existing.title,
      description: updates.description !== undefined ? updates.description : existing.description,
      domainId: updates.domainId !== undefined ? updates.domainId : existing.domainId,
      skillId: updates.skillId !== undefined ? updates.skillId : existing.skillId,
      isArchived: updates.isArchived !== undefined ? updates.isArchived : existing.isArchived,
      archivedAt: updates.isArchived ? new Date().toISOString() : null,
      metadata: updates.metadata ? { ...existing.metadata, ...updates.metadata } : existing.metadata,
      updatedAt: new Date().toISOString(),
    };
    this.nodes.set(nodeId, updated);
    return updated;
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    return this.nodes.delete(nodeId);
  }

  async getEdge(edgeId: string): Promise<KnowledgeEdge | null> {
    const e = this.edges.get(edgeId);
    return e && e.userId === this.userId ? e : null;
  }

  async listEdges(filter?: {
    domainId?: string | null;
    status?: string;
    relationType?: string;
  }): Promise<KnowledgeEdge[]> {
    let list = Array.from(this.edges.values()).filter((e) => e.userId === this.userId);
    if (filter?.relationType) list = list.filter((e) => e.relationType === filter.relationType);
    if (filter?.status === "archived") {
      list = list.filter((e) => e.isArchived);
    } else if (filter?.status === "verified") {
      list = list.filter((e) => e.verificationStatus === "verified" && !e.isArchived);
    } else if (filter?.status === "inferred") {
      list = list.filter((e) => e.verificationStatus === "inferred" && !e.isArchived);
    } else if (filter?.status === "any") {
      // Entire universe
    } else {
      list = list.filter(
        (e) => (e.verificationStatus === "inferred" || e.verificationStatus === "verified") && !e.isArchived,
      );
    }
    return list;
  }

  async createEdge(input: CreateKnowledgeEdgeInput): Promise<KnowledgeEdge> {
    let sourceId = input.sourceNodeId;
    let targetId = input.targetNodeId;

    if (input.relationType === "contradicts" || input.relationType === "relates_to") {
      if (sourceId > targetId) {
        sourceId = input.targetNodeId;
        targetId = input.sourceNodeId;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isAi = input.sourceType === "ai_proposal";
    const edge: KnowledgeEdge = {
      id,
      userId: this.userId,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      relationType: input.relationType,
      verificationStatus: isAi ? "inferred" : "verified",
      confidence: isAi ? Math.min(input.confidence ?? 0.8, 0.95) : 1.0,
      sourceType: input.sourceType ?? "user_created",
      sourceId: input.sourceId ?? null,
      provenanceNote: input.provenanceNote ?? null,
      verifiedAt: isAi ? null : now,
      verifiedBy: isAi ? null : this.userId,
      isArchived: false,
      archivedAt: null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.edges.set(id, edge);
    return edge;
  }

  async deleteEdge(edgeId: string): Promise<boolean> {
    return this.edges.delete(edgeId);
  }

  async getNodeDetail(nodeId: string): Promise<KnowledgeNodeDetailResponse | null> {
    const node = await this.getNode(nodeId);
    if (!node) return null;
    return {
      node: {
        ...node,
        domainName: null,
        skillName: null,
      },
      provenance: {
        sourceActivity: null,
        sourceArtifact: null,
        evidenceRecords: [],
      },
      connections: {
        inbound: [],
        outbound: [],
      },
    };
  }

  async getEdgeDetail(edgeId: string): Promise<KnowledgeEdgeDetailResponse | null> {
    const edge = await this.getEdge(edgeId);
    if (!edge) return null;
    return {
      edge: {
        ...edge,
        sourceNodeTitle: "Node",
        targetNodeTitle: "Node",
      },
      provenance: {
        sourceActivity: null,
        sourceArtifact: null,
      },
    };
  }

  async applyNodeAuthorityTransition(
    nodeId: string,
    transition: "verify" | "reject",
  ): Promise<KnowledgeNode> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new NotFoundError(`Knowledge node ${nodeId} not found`);
    }
    if (node.verificationStatus !== "inferred") {
      throw new InvalidAuthorityTransitionError(
        `Cannot ${transition} node with status '${node.verificationStatus}': only 'inferred' nodes may be transitioned`,
      );
    }
    const updated: KnowledgeNode = {
      ...node,
      verificationStatus: transition === "verify" ? "verified" : "rejected",
      confidence: transition === "verify" ? 1.0 : node.confidence,
      verifiedAt: transition === "verify" ? new Date().toISOString() : null,
      verifiedBy: transition === "verify" ? this.userId : null,
      updatedAt: new Date().toISOString(),
    };
    this.nodes.set(nodeId, updated);
    return updated;
  }

  async applyEdgeAuthorityTransition(
    edgeId: string,
    transition: "verify" | "reject",
  ): Promise<KnowledgeEdge> {
    const edge = await this.getEdge(edgeId);
    if (!edge) {
      throw new NotFoundError(`Knowledge edge ${edgeId} not found`);
    }
    if (edge.verificationStatus !== "inferred") {
      throw new InvalidAuthorityTransitionError(
        `Cannot ${transition} edge with status '${edge.verificationStatus}': only 'inferred' edges may be transitioned`,
      );
    }
    const updated: KnowledgeEdge = {
      ...edge,
      verificationStatus: transition === "verify" ? "verified" : "rejected",
      confidence: transition === "verify" ? 1.0 : edge.confidence,
      verifiedAt: transition === "verify" ? new Date().toISOString() : null,
      verifiedBy: transition === "verify" ? this.userId : null,
      updatedAt: new Date().toISOString(),
    };
    this.edges.set(edgeId, updated);
    return updated;
  }
}

/** Request-scoped factory for Knowledge Repository */
export async function getAuthenticatedKnowledgeRepository(): Promise<KnowledgeRepository> {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new SupabaseKnowledgeRepository(client, data.user.id);
}

export async function getRequestKnowledgeRepository(): Promise<KnowledgeRepository> {
  if (!isSupabaseConfigured()) return new DemoKnowledgeRepository();
  return getAuthenticatedKnowledgeRepository();
}
