// src/app/api/knowledge/edges/[id]/route.ts
// Stage 6B Knowledge Edge Detail & Deletion Endpoint

import { NextResponse } from "next/server";
import { getRequestKnowledgeRepository } from "@/lib/store/knowledge-repository";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid edge ID format" }, { status: 400 });
    }

    const repo = await getRequestKnowledgeRepository();
    const detail = await repo.getEdgeDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Knowledge edge not found" }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to get knowledge edge detail", error);
    return NextResponse.json({ error: "Failed to get knowledge edge detail" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid edge ID format" }, { status: 400 });
    }

    const repo = await getRequestKnowledgeRepository();
    const deleted = await repo.deleteEdge(id);

    if (!deleted) {
      return NextResponse.json({ error: "Knowledge edge not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to delete knowledge edge", error);
    return NextResponse.json({ error: "Failed to delete knowledge edge" }, { status: 500 });
  }
}
