import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import type { SkillEdgeRelationType } from "@/lib/store/types";

const VALID_RELATIONS: SkillEdgeRelationType[] = ["prerequisite", "contains", "supports"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val);
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate first (P1-3)
    const repo = await getRequestRepository();

    // 2. Parse JSON body
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
    const sourceSkillId = b.sourceSkillId;
    const targetSkillId = b.targetSkillId;
    const relationType = b.relationType as SkillEdgeRelationType;

    // 3. Strict UUID and field validation (P1-4)
    if (!isValidUuid(sourceSkillId)) {
      return NextResponse.json(
        { error: "sourceSkillId must be a valid UUID" },
        { status: 400 },
      );
    }

    if (!isValidUuid(targetSkillId)) {
      return NextResponse.json(
        { error: "targetSkillId must be a valid UUID" },
        { status: 400 },
      );
    }

    if (sourceSkillId === targetSkillId) {
      return NextResponse.json(
        { error: "Self-edges are forbidden: sourceSkillId cannot equal targetSkillId" },
        { status: 400 },
      );
    }

    if (!VALID_RELATIONS.includes(relationType)) {
      return NextResponse.json(
        { error: `relationType must be one of: ${VALID_RELATIONS.join(", ")}` },
        { status: 400 },
      );
    }

    // 4. Execute domain addEdge
    const edge = await repo.addEdge({
      sourceSkillId,
      targetSkillId,
      relationType,
    });

    return NextResponse.json(edge, { status: 201 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);

    if (
      message.includes("Cycle detected") ||
      message.includes("cycle") ||
      message.includes("Single-parent") ||
      message.includes("contains parent") ||
      message.includes("Duplicate edge") ||
      message.includes("duplicate key") ||
      message.includes("23505")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (
      message.includes("Self-edges") ||
      message.includes("not found") ||
      message.includes("foreign key") ||
      message.includes("23503") ||
      message.includes("violates check constraint")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Failed to create skill edge", error);
    return NextResponse.json({ error: "Failed to create skill edge" }, { status: 500 });
  }
}
