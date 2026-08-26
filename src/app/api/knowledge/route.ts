// src/app/api/knowledge/route.ts
// Stage 6B Knowledge Graph Read & Node Creation Endpoint

import { NextResponse } from "next/server";
import { getRequestKnowledgeRepository } from "@/lib/store/knowledge-repository";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { computeKnowledgeGraph, InvalidDepthError } from "@/lib/knowledge/graph-layout";
import { NotFoundError } from "@/lib/knowledge/authority-service";
import { isValidUuid } from "@/lib/http/validation";
import type { KnowledgeNodeType, KnowledgeSourceType } from "@/lib/knowledge/types";

const VALID_NODE_TYPES: KnowledgeNodeType[] = ["concept", "claim", "topic"];
const VALID_SOURCE_TYPES: KnowledgeSourceType[] = [
  "activity",
  "artifact",
  "user_created",
  "ai_proposal",
  "imported",
];
const VALID_STATUSES = ["all", "verified", "inferred", "archived"];

export async function GET(request: Request) {
  try {
    const kRepo = await getRequestKnowledgeRepository();
    const sRepo = await getRequestRepository();

    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId");
    const statusParam = searchParams.get("status");
    const nodeTypeParam = searchParams.get("nodeType");
    const search = searchParams.get("search");
    const rootNodeId = searchParams.get("rootNodeId");
    const depthParam = searchParams.get("depth");
    const limitParam = searchParams.get("limit");

    // 1. Strict Query Validations
    if (domainId !== null && !isValidUuid(domainId)) {
      return NextResponse.json({ error: "domainId must be a valid UUID" }, { status: 400 });
    }

    if (rootNodeId !== null && !isValidUuid(rootNodeId)) {
      return NextResponse.json({ error: "rootNodeId must be a valid UUID" }, { status: 400 });
    }

    if (statusParam !== null && !VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}`, code: "invalid_status" },
        { status: 400 },
      );
    }

    if (nodeTypeParam !== null && !VALID_NODE_TYPES.includes(nodeTypeParam as KnowledgeNodeType)) {
      return NextResponse.json(
        { error: `nodeType must be one of: ${VALID_NODE_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    let depth: number | undefined = undefined;
    if (depthParam !== null) {
      const parsedDepth = Number(depthParam);
      if (!Number.isInteger(parsedDepth) || parsedDepth < 1 || parsedDepth > 3) {
        return NextResponse.json(
          { error: "depth must be an integer between 1 and 3", code: "invalid_depth" },
          { status: 400 },
        );
      }
      depth = parsedDepth;
    }

    let limit: number | undefined = undefined;
    if (limitParam !== null) {
      const parsedLimit = Number(limitParam);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json(
          { error: "limit must be a positive integer" },
          { status: 400 },
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    // 2. Fetch Graph Data
    // If rootNodeId is specified, fetch entire tenant universe to enable k-hop traversal
    // Otherwise fetch nodes matching the requested status (P1-archived query fix)
    const nodeFetchStatus = rootNodeId ? "any" : (statusParam ?? "all");
    const edgeFetchStatus = rootNodeId ? "any" : (statusParam ?? "all");

    const [domains, skills, allNodes, allEdges] = await Promise.all([
      sRepo.listDomains(),
      sRepo.listSkills(),
      kRepo.listNodes({ status: nodeFetchStatus }),
      kRepo.listEdges({ status: edgeFetchStatus }),
    ]);

    // 3. Compute Progressive Layout & Metrics
    const graph = computeKnowledgeGraph(domains, skills, allNodes, allEdges, {
      domainId: domainId ?? undefined,
      status: (statusParam ?? "all") as "all" | "verified" | "inferred" | "archived",
      nodeType: (nodeTypeParam as KnowledgeNodeType) ?? undefined,
      search: search ?? undefined,
      rootNodeId: rootNodeId ?? undefined,
      depth,
      limit,
    });

    return NextResponse.json(graph, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidDepthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error("Failed to query knowledge graph", error);
    return NextResponse.json({ error: "Failed to query knowledge graph" }, { status: 500 });
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
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title || title.length === 0) {
      return NextResponse.json({ error: "Title cannot be empty", code: "empty_title" }, { status: 400 });
    }

    const nodeType = b.nodeType as KnowledgeNodeType | undefined;
    if (nodeType !== undefined && !VALID_NODE_TYPES.includes(nodeType)) {
      return NextResponse.json(
        { error: `nodeType must be one of: ${VALID_NODE_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const domainId = b.domainId as string | null | undefined;
    if (domainId && !isValidUuid(domainId)) {
      return NextResponse.json({ error: "domainId must be a valid UUID" }, { status: 400 });
    }

    const skillId = b.skillId as string | null | undefined;
    if (skillId && !isValidUuid(skillId)) {
      return NextResponse.json({ error: "skillId must be a valid UUID" }, { status: 400 });
    }

    const sourceType = b.sourceType as KnowledgeSourceType | undefined;
    if (sourceType !== undefined && !VALID_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const sourceId = b.sourceId as string | null | undefined;
    if (sourceId && !isValidUuid(sourceId)) {
      return NextResponse.json({ error: "sourceId must be a valid UUID" }, { status: 400 });
    }

    const confidence = typeof b.confidence === "number" ? b.confidence : undefined;
    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      return NextResponse.json({ error: "confidence must be between 0.0 and 1.0" }, { status: 400 });
    }

    const node = await repo.createNode({
      title,
      nodeType,
      description: typeof b.description === "string" ? b.description : null,
      domainId: domainId ?? null,
      skillId: skillId ?? null,
      sourceType,
      sourceId: sourceId ?? null,
      confidence,
      metadata: typeof b.metadata === "object" && b.metadata !== null ? (b.metadata as Record<string, unknown>) : undefined,
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "A knowledge node with this title already exists", code: "duplicate_node" }, { status: 409 });
    }

    if (message.includes("23503") || message.includes("Invalid provenance target") || message.includes("foreign key")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message.includes("23514") || message.includes("check constraint")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Failed to create knowledge node", error);
    return NextResponse.json({ error: "Failed to create knowledge node" }, { status: 500 });
  }
}
