import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import type { SkillEdgeRelationType } from "@/lib/store/types";

const VALID_RELATIONS: SkillEdgeRelationType[] = ["prerequisite", "contains", "supports"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const sourceSkillId = typeof body.sourceSkillId === "string" ? body.sourceSkillId.trim() : "";
    const targetSkillId = typeof body.targetSkillId === "string" ? body.targetSkillId.trim() : "";
    const relationType = body.relationType as SkillEdgeRelationType;

    if (!sourceSkillId || !targetSkillId) {
      return NextResponse.json(
        { error: "sourceSkillId and targetSkillId are required" },
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

    const repo = await getRequestRepository();
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
      message.includes("unique_contains_parent")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (
      message.includes("Self-edges") ||
      message.includes("not found") ||
      message.includes("violates foreign key") ||
      message.includes("cross-tenant")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Failed to create skill edge", error);
    return NextResponse.json({ error: message || "Failed to create skill edge" }, { status: 500 });
  }
}
