// src/lib/knowledge/types.ts
// Stage 6 Knowledge Map Domain, DTO & Authority Type Definitions

export type KnowledgeNodeType = "concept" | "claim" | "topic";

export type KnowledgeVerificationStatus =
  | "inferred"
  | "verified"
  | "rejected"
  | "superseded";

export type KnowledgeSourceType =
  | "activity"
  | "artifact"
  | "user_created"
  | "ai_proposal"
  | "imported";

export type KnowledgeRelationType =
  | "prerequisite"
  | "contains"
  | "supports"
  | "contradicts"
  | "relates_to";

export interface KnowledgeNode {
  id: string;
  userId: string;
  domainId: string | null;
  domainName?: string | null;
  skillId: string | null;
  skillName?: string | null;
  nodeType: KnowledgeNodeType;
  title: string;
  normalizedTitle?: string | null;
  description: string | null;
  verificationStatus: KnowledgeVerificationStatus;
  confidence: number;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEdge {
  id: string;
  userId: string;
  sourceNodeId: string;
  sourceNodeTitle?: string;
  sourceNodeType?: KnowledgeNodeType;
  targetNodeId: string;
  targetNodeTitle?: string;
  targetNodeType?: KnowledgeNodeType;
  relationType: KnowledgeRelationType;
  verificationStatus: KnowledgeVerificationStatus;
  confidence: number;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  provenanceNote: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeNodeInput {
  nodeType?: KnowledgeNodeType;
  title: string;
  description?: string | null;
  domainId?: string | null;
  skillId?: string | null;
  sourceType?: KnowledgeSourceType;
  sourceId?: string | null;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeNodeInput {
  title?: string;
  description?: string | null;
  domainId?: string | null;
  skillId?: string | null;
  isArchived?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeEdgeInput {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: KnowledgeRelationType;
  sourceType?: KnowledgeSourceType;
  sourceId?: string | null;
  provenanceNote?: string | null;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraphQueryOptions {
  domainId?: string | null;
  status?: "all" | "verified" | "inferred" | "archived";
  nodeType?: KnowledgeNodeType;
  search?: string;
  rootNodeId?: string;
  depth?: number;
  limit?: number;
}

export interface KnowledgeGraphResponse {
  domains: Array<{
    id: string;
    name: string;
    slug: string;
    nodeCount: number;
  }>;
  nodes: Array<{
    id: string;
    title: string;
    nodeType: KnowledgeNodeType;
    domainId: string | null;
    domainName: string | null;
    skillId: string | null;
    skillName: string | null;
    verificationStatus: KnowledgeVerificationStatus;
    isArchived: boolean;
    confidence: number;
    sourceType: KnowledgeSourceType;
    sourceId: string | null;
    inboundEdgeCount: number;
    outboundEdgeCount: number;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationType: KnowledgeRelationType;
    verificationStatus: KnowledgeVerificationStatus;
    isArchived: boolean;
    confidence: number;
    sourceType: KnowledgeSourceType;
    sourceId: string | null;
    provenanceNote: string | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
  }>;
  stats: {
    totalNodes: number;
    verifiedNodes: number;
    inferredNodes: number;
    totalEdges: number;
    verifiedEdges: number;
    inferredEdges: number;
    isTruncated: boolean;
  };
}

export interface KnowledgeNodeDetailResponse {
  node: {
    id: string;
    title: string;
    description: string | null;
    nodeType: KnowledgeNodeType;
    domainId: string | null;
    domainName: string | null;
    skillId: string | null;
    skillName: string | null;
    verificationStatus: KnowledgeVerificationStatus;
    isArchived: boolean;
    confidence: number;
    sourceType: KnowledgeSourceType;
    sourceId: string | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
    metadata: Record<string, unknown>;
    lastReviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  provenance: {
    sourceActivity: {
      id: string;
      title: string;
      activityType: string;
      completedAt: string;
    } | null;
    sourceArtifact: {
      id: string;
      title: string;
      type: string;
    } | null;
    evidenceRecords: Array<{
      id: string;
      type: string;
      content: string;
      verified: boolean;
      createdAt: string;
    }>;
  };
  connections: {
    inbound: Array<{
      edgeId: string;
      sourceNodeId: string;
      sourceNodeTitle: string;
      sourceNodeType: string;
      relationType: string;
      verificationStatus: string;
      confidence: number;
      sourceType: string;
      sourceId: string | null;
      provenanceNote: string | null;
    }>;
    outbound: Array<{
      edgeId: string;
      targetNodeId: string;
      targetNodeTitle: string;
      targetNodeType: string;
      relationType: string;
      verificationStatus: string;
      confidence: number;
      sourceType: string;
      sourceId: string | null;
      provenanceNote: string | null;
    }>;
  };
}

export interface KnowledgeEdgeDetailResponse {
  edge: {
    id: string;
    sourceNodeId: string;
    sourceNodeTitle: string;
    targetNodeId: string;
    targetNodeTitle: string;
    relationType: KnowledgeRelationType;
    verificationStatus: KnowledgeVerificationStatus;
    confidence: number;
    isArchived: boolean;
    sourceType: KnowledgeSourceType;
    sourceId: string | null;
    provenanceNote: string | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
    createdAt: string;
    updatedAt: string;
  };
  provenance: {
    sourceActivity: {
      id: string;
      title: string;
      completedAt: string;
    } | null;
    sourceArtifact: {
      id: string;
      title: string;
      type: string;
    } | null;
  };
}
