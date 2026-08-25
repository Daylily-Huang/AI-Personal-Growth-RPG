// src/app/api/knowledge/edges/route.ts
// Stage 6B Knowledge Edges Query & Creation Endpoint

import { NextResponse } from "next/server";
import { getRequestKnowledgeRepository } from "@/lib/store/knowledge-repository";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";
import type {
  KnowledgeRelationType,
  KnowledgeSourceType,
} from "@/lib/knowledge/types";

const VALID_RELATIONS: KnowledgeRelationType[] = [
  "prerequisite",
  "contains",
  "supports",
  "contradicts",
  "relates_to",
];

const VALID_SOURCE_TYPES: KnowledgeSourceType[] = [
  "activity",
  "artifact",
  "user_created",
  "ai_proposal",
  "imported",
];

export async function GET(request: Request) {
  try {
    const repo = await getRequestKnowledgeRepository();
    const { searchParams } = new URL(request.url);

    const relationType = searchParams.get("relationType");
    const status = searchParams.get("status");

    if (relationType !== null && !VALID_RELATIONS.includes(relationType as KnowledgeRelationType)) {
      return NextResponse.json(
        { error: `relationType must be one of: ${VALID_RELATIONS.join(", ")}` },
        { status: 400 },
      );
    }

    const edges = await repo.listEdges({
      relationType: (relationType as KnowledgeRelationType) ?? undefined,
      status: status ?? undefined,
    });

    return NextResponse.json(edges, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to list knowledge edges", error);
    return NextResponse.json({ error: "Failed to list knowledge edges" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const repo = await getRequestKnowledgeRepository();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const sourceNodeId = b.sourceNodeId;
    const targetNodeId = b.targetNodeId;
    const relationType = b.relationType as KnowledgeRelationType;
    const sourceType = b.sourceType as KnowledgeSourceType | undefined;
    const sourceId = b.sourceId as string | null | undefined;
    const provenanceNote = typeof b.provenanceNote === "string" ? b.provenanceNote.trim() : null;
    const confidence = typeof b.confidence === "number" ? b.confidence : undefined;

    // 1. Strict Field Validations
    if (!isValidUuid(sourceNodeId)) {
      return NextResponse.json(
        { error: "sourceNodeId must be a valid UUID" },
        { status: 400 },
      );
    }

    if (!isValidUuid(targetNodeId)) {
      return NextResponse.json(
        { error: "targetNodeId must be a valid UUID" },
        { status: 400 },
      );
    }

    if (sourceNodeId === targetNodeId) {
      return NextResponse.json(
        { error: "Self-edges are forbidden: sourceNodeId cannot equal targetNodeId", code: "self_reference_forbidden" },
        { status: 400 },
      );
    }

    if (!VALID_RELATIONS.includes(relationType)) {
      return NextResponse.json(
        { error: `relationType must be one of: ${VALID_RELATIONS.join(", ")}` },
        { status: 400 },
      );
    }

    if (relationType === "relates_to") {
      if (!provenanceNote || provenanceNote.length === 0) {
        return NextResponse.json(
          {
            error: "relates_to edges require a non-empty provenanceNote explaining the conceptual connection",
            code: "missing_provenance_note",
          },
          { status: 400 },
        );
      }
    }

    if (sourceType !== undefined && !VALID_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (sourceId && !isValidUuid(sourceId)) {
      return NextResponse.json(
        { error: "sourceId must be a valid UUID" },
        { status: 400 },
      );
    }

    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      return NextResponse.json(
        { error: "confidence must be between 0.0 and 1.0" },
        { status: 400 },
      );
    }

    const edge = await repo.createEdge({
      sourceNodeId,
      targetNodeId,
      relationType,
      sourceType,
      sourceId: sourceId ?? null,
      provenanceNote,
      confidence,
      metadata: typeof b.metadata === "object" && b.metadata !== null ? (b.metadata as Record<string, unknown>) : undefined,
    });

    return NextResponse.json(edge, { status: 201 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes("Cyclic dependency") ||
      message.includes("cycle") ||
      message.includes("23514") && message.includes("Cycle")
    ) {
      return NextResponse.json({ error: message, code: "cyclic_dependency" }, { status: 409 });
    }

    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "Duplicate relation edge between these nodes", code: "duplicate_edge" }, { status: 409 });
    }

    if (
      message.includes("Invalid provenance target") ||
      message.includes("foreign key") ||
      message.includes("23503") ||
      message.includes("23514")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Failed to create knowledge edge", error);
    return NextResponse.json({ error: "Failed to create knowledge edge" }, { status: 500 });
  }
}
