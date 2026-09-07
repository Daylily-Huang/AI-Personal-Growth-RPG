// src/app/knowledge/components/presentation.ts
// Stage 6C 4-Channel Epistemic Visual Presentation Helpers

import type {
  KnowledgeNodeType,
  KnowledgeRelationType,
  KnowledgeVerificationStatus,
  KnowledgeSourceType,
} from "@/lib/knowledge/types";

/**
 * 4-Channel Visual Encoding Definition:
 * 1. Border / Stroke pattern (solid / dashed / dotted)
 * 2. Frozen semantic authority tokens on light surfaces
 * 3. Icon / Badge
 * 4. Explicit Text / Label
 */

export interface AuthorityVisual {
  status: KnowledgeVerificationStatus;
  label: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  iconName: "CheckCircle2" | "Sparkles" | "Archive" | "XCircle" | "HelpCircle";
  strokeDasharray?: string;
}

export function getAuthorityVisual(
  status: KnowledgeVerificationStatus,
  isArchived = false,
  confidence = 1.0,
): AuthorityVisual {
  if (isArchived) {
    return {
      status,
      label: "[ARCHIVED]",
      badgeClass: "bg-[var(--surface-ground)] text-[var(--text-secondary)] border border-[var(--border-subtle)]",
      borderClass: "border-dotted border-[var(--border-default)]",
      bgClass: "bg-[var(--surface-raised)]",
      iconName: "Archive",
      strokeDasharray: "3 3",
    };
  }

  switch (status) {
    case "verified":
      return {
        status: "verified",
        label: "[VERIFIED]",
        badgeClass: "bg-[var(--authority-verified-bg)] text-[var(--authority-verified-text)] border border-[var(--authority-verified-border)]",
        borderClass: "border-solid border-[var(--authority-verified-border)]",
        bgClass: "bg-[var(--surface-raised)]",
        iconName: "CheckCircle2",
      };
    case "inferred":
      return {
        status: "inferred",
        label: `[AI PROPOSED ${Math.round(confidence * 100)}%]`,
        badgeClass: "bg-[var(--authority-inferred-bg)] text-[var(--authority-inferred-text)] border border-[var(--authority-inferred-border)]",
        borderClass: "border-dashed border-[var(--authority-inferred-border)]",
        bgClass: "bg-[var(--surface-raised)]",
        iconName: "Sparkles",
        strokeDasharray: "5 5",
      };
    case "rejected":
      return {
        status: "rejected",
        label: "[REJECTED]",
        badgeClass: "bg-[var(--authority-rejected-bg)] text-[var(--authority-rejected-text)] border border-[var(--authority-rejected-border)]",
        borderClass: "border-solid border-[var(--authority-rejected-border)]",
        bgClass: "bg-[var(--surface-raised)]",
        iconName: "XCircle",
      };
    case "superseded":
      return {
        status: "superseded",
        label: "[SUPERSEDED]",
        badgeClass: "bg-[var(--authority-superseded-bg)] text-[var(--authority-superseded-text)] border border-[var(--authority-superseded-border)]",
        borderClass: "border-dotted border-[var(--border-default)]",
        bgClass: "bg-[var(--surface-raised)]",
        iconName: "HelpCircle",
      };
  }
}

export interface NodeTypeVisual {
  type: KnowledgeNodeType;
  label: string;
  iconName: "BookOpen" | "Quote" | "FolderTree";
  shapeClass: string;
  headerBgClass: string;
}

export function getNodeTypeVisual(type: KnowledgeNodeType): NodeTypeVisual {
  switch (type) {
    case "concept":
      return {
        type: "concept",
        label: "Concept",
        iconName: "BookOpen",
        shapeClass: "rounded-xl border",
        headerBgClass: "bg-[var(--entity-knowledge-bg)] text-[var(--entity-knowledge-text)]",
      };
    case "claim":
      return {
        type: "claim",
        label: "Claim",
        iconName: "Quote",
        shapeClass: "rounded-2xl border-l-4 border-l-[var(--entity-knowledge-border)] border-t border-r border-b",
        headerBgClass: "bg-[var(--entity-knowledge-bg)] text-[var(--entity-knowledge-text)]",
      };
    case "topic":
      return {
        type: "topic",
        label: "Topic",
        iconName: "FolderTree",
        shapeClass: "rounded-lg border-2 border-double",
        headerBgClass: "bg-[var(--entity-knowledge-bg)] text-[var(--entity-knowledge-text)]",
      };
  }
}

export interface EdgeRelationVisual {
  relationType: KnowledgeRelationType;
  label: string;
  color: string;
  strokeDasharray?: string;
  animated: boolean;
  marker: "arrow" | "circle" | "hollow-arrow" | "none";
  isSymmetric: boolean;
}

function getRelationVisual(
  relationType: KnowledgeRelationType,
  verificationStatus: KnowledgeVerificationStatus,
  confidence: number,
): EdgeRelationVisual {
  const isInferred = verificationStatus === "inferred";

  switch (relationType) {
    case "prerequisite":
      return {
        relationType: "prerequisite",
        label: isInferred ? `PRE-REQ (AI ${Math.round(confidence * 100)}%)` : "PREREQUISITE",
        color: isInferred ? "var(--authority-inferred-text)" : "var(--authority-verified-text)", // Amber / Sky
        strokeDasharray: isInferred ? "5 5" : undefined,
        animated: false,
        marker: isInferred ? "hollow-arrow" : "arrow",
        isSymmetric: false,
      };
    case "contains":
      return {
        relationType: "contains",
        label: isInferred ? `CONTAINS (AI ${Math.round(confidence * 100)}%)` : "CONTAINS",
        color: "var(--entity-knowledge-text)", // Purple-400
        strokeDasharray: "4 4",
        animated: false,
        marker: isInferred ? "hollow-arrow" : "arrow",
        isSymmetric: false,
      };
    case "supports":
      return {
        relationType: "supports",
        label: isInferred ? `SUPPORTS (AI ${Math.round(confidence * 100)}%)` : "SUPPORTS",
        color: "var(--authority-verified-text)", // Emerald-400
        strokeDasharray: isInferred ? "5 5" : undefined,
        animated: false,
        marker: isInferred ? "hollow-arrow" : "arrow",
        isSymmetric: false,
      };
    case "contradicts":
      // P1-1: Multi-channel distinction for Inferred vs Verified Contradicts
      // P1-2: Symmetric relation (neutral lightning marker, no directional arrow)
      return {
        relationType: "contradicts",
        label: isInferred
          ? `CONTRADICTS · AI ${Math.round(confidence * 100)}%`
          : "CONTRADICTS [VERIFIED]",
        color: isInferred ? "var(--authority-inferred-text)" : "var(--state-danger-text)", // Rose-400 / Rose-500
        strokeDasharray: isInferred ? "4 3" : undefined, // Inferred is dashed, Verified is solid
        animated: false,
        marker: "none",
        isSymmetric: true,
      };
    case "relates_to":
      // P1-2: Symmetric relation -> NO directional arrow!
      return {
        relationType: "relates_to",
        label: isInferred ? `RELATES (AI ${Math.round(confidence * 100)}%)` : "RELATES TO",
        color: "var(--text-secondary)", // Blue-400
        strokeDasharray: "6 4",
        animated: false,
        marker: "none",
        isSymmetric: true,
      };
  }
}

export function getEdgeVisual(
  relationType: KnowledgeRelationType,
  verificationStatus: KnowledgeVerificationStatus,
  confidence: number,
  isArchived = false,
): EdgeRelationVisual {
  const visual = getRelationVisual(relationType, verificationStatus, confidence);
  if (verificationStatus === "rejected" || verificationStatus === "superseded") {
    visual.label = `${relationType.toUpperCase()} [${verificationStatus.toUpperCase()}]`;
    visual.color = verificationStatus === "rejected" ? "var(--authority-rejected-text)" : "var(--authority-superseded-text)";
    visual.strokeDasharray = "2 4";
  }
  if (isArchived) {
    visual.label += ` [ARCHIVED · ${verificationStatus.toUpperCase()}]`;
    visual.strokeDasharray = "2 4";
  }
  return visual;
}

export function formatSourceType(sourceType: KnowledgeSourceType): string {
  switch (sourceType) {
    case "activity":
      return "Activity Record";
    case "artifact":
      return "Project Artifact";
    case "ai_proposal":
      return "AI Proposal (backed by Activity)";
    case "user_created":
      return "User Manual Entry";
    case "imported":
      return "External Import";
  }
}
