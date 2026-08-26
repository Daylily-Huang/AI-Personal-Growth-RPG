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
 * 2. Color scheme (sky, emerald, amber, rose, purple, zinc)
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
      badgeClass: "bg-zinc-800 text-zinc-400 border border-zinc-700",
      borderClass: "border-dotted border-zinc-600/80 opacity-60",
      bgClass: "bg-zinc-900/60",
      iconName: "Archive",
      strokeDasharray: "3 3",
    };
  }

  switch (status) {
    case "verified":
      return {
        status: "verified",
        label: "[VERIFIED]",
        badgeClass: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50",
        borderClass: "border-solid border-sky-500/70 shadow-sky-950/30",
        bgClass: "bg-slate-900/90",
        iconName: "CheckCircle2",
      };
    case "inferred":
      return {
        status: "inferred",
        label: `[AI PROPOSED ${Math.round(confidence * 100)}%]`,
        badgeClass: "bg-amber-950/80 text-amber-300 border border-amber-500/50",
        borderClass: "border-dashed border-amber-500/70 shadow-amber-950/30",
        bgClass: "bg-slate-900/80",
        iconName: "Sparkles",
        strokeDasharray: "5 5",
      };
    case "rejected":
      return {
        status: "rejected",
        label: "[REJECTED]",
        badgeClass: "bg-rose-950/80 text-rose-300 border border-rose-500/50",
        borderClass: "border-solid border-rose-600/60 opacity-60",
        bgClass: "bg-zinc-900/80",
        iconName: "XCircle",
      };
    case "superseded":
      return {
        status: "superseded",
        label: "[SUPERSEDED]",
        badgeClass: "bg-zinc-800 text-zinc-400 border border-zinc-600",
        borderClass: "border-dotted border-zinc-600 opacity-50",
        bgClass: "bg-zinc-900/60",
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
        headerBgClass: "bg-sky-950/40 text-sky-300",
      };
    case "claim":
      return {
        type: "claim",
        label: "Claim",
        iconName: "Quote",
        shapeClass: "rounded-2xl border-l-4 border-l-amber-400 border-t border-r border-b",
        headerBgClass: "bg-amber-950/40 text-amber-300",
      };
    case "topic":
      return {
        type: "topic",
        label: "Topic",
        iconName: "FolderTree",
        shapeClass: "rounded-lg border-2 border-double",
        headerBgClass: "bg-purple-950/40 text-purple-300",
      };
  }
}

export interface EdgeRelationVisual {
  relationType: KnowledgeRelationType;
  label: string;
  color: string;
  strokeDasharray?: string;
  animated: boolean;
  marker: "arrow" | "circle" | "lightning" | "hollow-arrow";
}

export function getEdgeVisual(
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
        color: isInferred ? "#f59e0b" : "#38bdf8", // Amber / Sky
        strokeDasharray: isInferred ? "5 5" : undefined,
        animated: isInferred,
        marker: isInferred ? "hollow-arrow" : "arrow",
      };
    case "contains":
      return {
        relationType: "contains",
        label: isInferred ? `CONTAINS (AI ${Math.round(confidence * 100)}%)` : "CONTAINS",
        color: "#c084fc", // Purple-400
        strokeDasharray: "4 4",
        animated: isInferred,
        marker: "circle",
      };
    case "supports":
      return {
        relationType: "supports",
        label: isInferred ? `SUPPORTS (AI ${Math.round(confidence * 100)}%)` : "SUPPORTS",
        color: "#34d399", // Emerald-400
        strokeDasharray: isInferred ? "5 5" : undefined,
        animated: isInferred,
        marker: isInferred ? "hollow-arrow" : "arrow",
      };
    case "contradicts":
      return {
        relationType: "contradicts",
        label: "CONTRADICTS",
        color: "#f43f5e", // Rose-500
        strokeDasharray: "3 3",
        animated: false,
        marker: "lightning",
      };
    case "relates_to":
      return {
        relationType: "relates_to",
        label: isInferred ? `RELATES (AI ${Math.round(confidence * 100)}%)` : "RELATES TO",
        color: "#60a5fa", // Blue-400
        strokeDasharray: "6 4",
        animated: isInferred,
        marker: isInferred ? "hollow-arrow" : "arrow",
      };
  }
}

export function formatSourceType(sourceType: KnowledgeSourceType): string {
  switch (sourceType) {
    case "activity":
      return "Activity Record";
    case "artifact":
      return "Project Artifact";
    case "ai_proposal":
      return "AI Growth Assessment";
    case "user_created":
      return "User Manual Entry";
    case "imported":
      return "External Import";
  }
}
