// src/app/api/knowledge/[id]/route.ts
// Stage 6B Knowledge Node Detail, Generic Metadata Update & Deletion Endpoint

import { NextResponse } from "next/server";
import { getRequestKnowledgeRepository } from "@/lib/store/knowledge-repository";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";
import type { UpdateKnowledgeNodeInput } from "@/lib/knowledge/types";

const FORBIDDEN_PATCH_FIELDS = [
  "verification_status",
  "verificationStatus",
  "confidence",
  "verified_at",
  "verifiedAt",
  "verified_by",
  "verifiedBy",
  "source_type",
  "sourceType",
  "source_id",
  "sourceId",
  "node_type",
  "nodeType",
  "user_id",
  "userId",
  "id",
];

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid node ID format" }, { status: 400 });
    }

    const repo = await getRequestKnowledgeRepository();
    const detail = await repo.getNodeDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Knowledge node not found" }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to get knowledge node detail", error);
    return NextResponse.json({ error: "Failed to get knowledge node detail" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid node ID format" }, { status: 400 });
    }

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

    // Strict Authority & Provenance Boundary Check (P0 & P1-1)
    for (const forbiddenKey of FORBIDDEN_PATCH_FIELDS) {
      if (forbiddenKey in b) {
        return NextResponse.json(
          {
            error: `Field '${forbiddenKey}' cannot be updated via generic PATCH. Authority transitions must use sanctioned endpoints.`,
            code: "forbidden_authority_mutation",
          },
          { status: 400 },
        );
      }
    }

    const updates: UpdateKnowledgeNodeInput = {};

    if (b.title !== undefined) {
      if (typeof b.title !== "string" || b.title.trim().length === 0) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      updates.title = b.title.trim();
    }

    if (b.description !== undefined) {
      updates.description = typeof b.description === "string" ? b.description : null;
    }

    if (b.domainId !== undefined) {
      if (b.domainId !== null && !isValidUuid(b.domainId)) {
        return NextResponse.json({ error: "domainId must be a valid UUID" }, { status: 400 });
      }
      updates.domainId = (b.domainId as string) ?? null;
    }

    if (b.skillId !== undefined) {
      if (b.skillId !== null && !isValidUuid(b.skillId)) {
        return NextResponse.json({ error: "skillId must be a valid UUID" }, { status: 400 });
      }
      updates.skillId = (b.skillId as string) ?? null;
    }

    if (b.isArchived !== undefined) {
      if (typeof b.isArchived !== "boolean") {
        return NextResponse.json({ error: "isArchived must be a boolean" }, { status: 400 });
      }
      updates.isArchived = b.isArchived;
    }

    if (b.metadata !== undefined) {
      if (typeof b.metadata !== "object" || b.metadata === null) {
        return NextResponse.json({ error: "metadata must be an object" }, { status: 400 });
      }
      updates.metadata = b.metadata as Record<string, unknown>;
    }

    const updatedNode = await repo.updateNodeMetadata(id, updates);
    return NextResponse.json(updatedNode, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("not found")) {
      return NextResponse.json({ error: "Knowledge node not found" }, { status: 404 });
    }

    if (message.includes("23505") || message.includes("duplicate key")) {
      return NextResponse.json({ error: "A knowledge node with this title already exists" }, { status: 409 });
    }

    if (message.includes("23514") || message.includes("check constraint")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Failed to update knowledge node", error);
    return NextResponse.json({ error: "Failed to update knowledge node" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid node ID format" }, { status: 400 });
    }

    const repo = await getRequestKnowledgeRepository();
    const deleted = await repo.deleteNode(id);

    if (!deleted) {
      return NextResponse.json({ error: "Knowledge node not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to delete knowledge node", error);
    return NextResponse.json({ error: "Failed to delete knowledge node" }, { status: 500 });
  }
}
