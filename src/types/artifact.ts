// src/types/artifact.ts
// Stage 7 Artifact Domain Model, Proposal & Resolution Types

export type ArtifactType =
  | "document"
  | "code_repository"
  | "design_spec"
  | "data_analysis"
  | "presentation"
  | "synthesis_note"
  | "creative_work"
  | "other";

export type ArtifactLifecycleStatus =
  | "draft"
  | "active"
  | "archived"
  | "superseded";

export interface Artifact {
  id: string;
  userId: string;
  title: string;
  normalizedTitle: string;
  artifactType: ArtifactType;
  summary: string | null;
  description: string | null;
  lifecycleStatus: ArtifactLifecycleStatus;
  version: string | null;
  storagePath: string | null;
  externalUrl: string | null;
  reusabilityScore: number;
  metadata: Record<string, unknown>;
  isArchived: boolean;

  archivedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ArtifactCounts {
  skills: number;
  knowledgeNodes: number;
  quests: number;
  activities: number;
  evidence: number;
}

export interface ArtifactWithCounts extends Artifact {
  counts: ArtifactCounts;
}

export interface ArtifactSkillLink {
  id: string;
  name: string;
  level: number;
  demonstrationLevel: number;
}

export interface ArtifactKnowledgeNodeLink {
  id: string;
  title: string;
  nodeType: string;
  verificationStatus: string;
  relationType: "cites" | "implements" | "synthesizes" | "evaluates";
}

export interface ArtifactQuestLink {
  id: string;
  title: string;
  status: string;
  isPrimaryDeliverable: boolean;
}

export interface ArtifactActivityLink {
  id: string;
  title: string;
  activityRole: "produced" | "referenced" | "modified";
  completedAt: string;
}

export interface ArtifactEvidenceLink {
  id: string;
  evidenceLevel: number;
  description: string;
  verified: boolean;
}

export interface ArtifactLinks {
  skills: ArtifactSkillLink[];
  knowledgeNodes: ArtifactKnowledgeNodeLink[];
  quests: ArtifactQuestLink[];
  activities: ArtifactActivityLink[];
  evidence: ArtifactEvidenceLink[];
}

export interface ArtifactDetail {
  artifact: Artifact;
  links: ArtifactLinks;
}

export interface CreateArtifactInput {
  title: string;
  artifactType: ArtifactType;
  summary?: string | null;
  description?: string | null;
  version?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  reusabilityScore?: number;
  metadata?: Record<string, unknown>;
  lifecycleStatus?: ArtifactLifecycleStatus;
  isArchived?: boolean;
  skillIds?: string[];
  knowledgeNodeIds?: string[];
  questIds?: string[];
  activityIds?: string[];
  evidenceIds?: string[];
}

export interface UpdateArtifactInput {
  title?: string;
  artifactType?: ArtifactType;
  summary?: string | null;
  description?: string | null;
  lifecycleStatus?: ArtifactLifecycleStatus;
  version?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  reusabilityScore?: number;
  metadata?: Record<string, unknown>;
  isArchived?: boolean;
}

export interface ManageArtifactLinksInput {
  activities?: Array<
    | { activityId: string; action: "attach"; activityRole?: "produced" | "referenced" | "modified" }
    | { activityId: string; action: "detach" }
  >;
  skills?: Array<
    | { skillId: string; action: "attach"; demonstrationLevel?: number }
    | { skillId: string; action: "detach" }
  >;
  knowledgeNodes?: Array<
    | { nodeId: string; action: "attach"; relationType?: "cites" | "implements" | "synthesizes" | "evaluates" }
    | { nodeId: string; action: "detach" }
  >;
  quests?: Array<
    | { questId: string; action: "attach"; isPrimaryDeliverable?: boolean }
    | { questId: string; action: "detach" }
  >;
  evidence?: Array<
    | { evidenceId: string; action: "attach" }
    | { evidenceId: string; action: "detach" }
  >;
}

export interface ArtifactProposal {
  title: string;
  artifactType: ArtifactType;
  summary?: string;
  description?: string;
  version?: string;
  externalUrl?: string;
  storagePath?: string;
  reusabilityScore?: number;
  metadata?: Record<string, unknown>;
  skillIds?: string[];
  knowledgeNodeIds?: string[];
  questIds?: string[];
}

export interface ApprovedOverrides {
  title?: string;
  artifactType?: ArtifactType;
  summary?: string;
  description?: string;
  version?: string;
  externalUrl?: string;
  storagePath?: string;
  reusabilityScore?: number;
}

export type ArtifactResolutionInput =
  | {
      proposalIndex: number;
      resolution: "create";
      approvedOverrides?: ApprovedOverrides;
    }
  | {
      proposalIndex: number;
      resolution: "existing";
      artifactId: string;
      activityRole?: "produced" | "modified" | "referenced";
    }
  | {
      proposalIndex: number;
      resolution: "ignore";
    };

