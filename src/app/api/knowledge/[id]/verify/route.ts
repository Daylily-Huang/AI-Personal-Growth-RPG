// src/app/api/knowledge/[id]/verify/route.ts
// Stage 6B Sanctioned Node Verification Authority Endpoint

import { NextResponse } from "next/server";
import { getRequestKnowledgeRepository } from "@/lib/store/knowledge-repository";
import { AuthRequiredError } from "@/lib/store/request-repository";
import {
  KnowledgeAuthorityService,
  NotFoundError,
  InvalidAuthorityTransitionError,
} from "@/lib/knowledge/authority-service";
import { isValidUuid } from "@/lib/http/validation";

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid node ID format" }, { status: 400 });
    }

    const repo = await getRequestKnowledgeRepository();
    const verifiedNode = await KnowledgeAuthorityService.verifyKnowledgeNode(
      repo.userId,
      id,
      repo,
    );

    return NextResponse.json(verifiedNode, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidAuthorityTransitionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }

    console.error("Failed to verify knowledge node", error);
    return NextResponse.json({ error: "Failed to verify knowledge node" }, { status: 500 });
  }
}
