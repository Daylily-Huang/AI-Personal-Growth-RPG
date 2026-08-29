// src/app/api/artifacts/route.ts
// Stage 7B Artifacts Gallery & Creation Route

import { NextResponse } from "next/server";
import { getRequestArtifactRepository, ArtifactTitleConflictError } from "@/lib/store/artifact-repository";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";
import type { ArtifactType, ArtifactLifecycleStatus, CreateArtifactInput } from "@/types/artifact";

const VALID_ARTIFACT_TYPES: ArtifactType[] = [
  "document",
  "code_repository",
  "design_spec",
  "data_analysis",
  "presentation",
  "synthesis_note",
  "creative_work",
  "other",
];

const VALID_STATUSES = ["active", "archived", "draft", "superseded", "all"];

export async function GET(request: Request) {
  try {
    const repo = await getRequestArtifactRepository();
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get("type");
    const statusParam = searchParams.get("status");
    const skillIdParam = searchParams.get("skillId");
    const questIdParam = searchParams.get("questId");
    const searchParam = searchParams.get("search");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    if (typeParam !== null && !VALID_ARTIFACT_TYPES.includes(typeParam as ArtifactType)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}`, code: "invalid_type" },
        { status: 400 },
      );
    }

    if (statusParam !== null && !VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}`, code: "invalid_status" },
        { status: 400 },
      );
    }

    if (skillIdParam !== null && !isValidUuid(skillIdParam)) {
      return NextResponse.json({ error: "skillId must be a valid UUID", code: "invalid_uuid" }, { status: 400 });
    }

    if (questIdParam !== null && !isValidUuid(questIdParam)) {
      return NextResponse.json({ error: "questId must be a valid UUID", code: "invalid_uuid" }, { status: 400 });
    }

    let limit: number | undefined = undefined;
    if (limitParam !== null) {
      const parsed = Number(limitParam);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return NextResponse.json({ error: "limit must be a positive integer", code: "invalid_limit" }, { status: 400 });
      }
      limit = Math.min(parsed, 100);
    }

    let offset: number | undefined = undefined;
    if (offsetParam !== null) {
      const parsed = Number(offsetParam);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return NextResponse.json({ error: "offset must be a non-negative integer", code: "invalid_offset" }, { status: 400 });
      }
      offset = parsed;
    }

    const result = await repo.listArtifacts({
      type: typeParam ?? undefined,
      status: statusParam ?? "active",
      skillId: skillIdParam ?? undefined,
      questId: questIdParam ?? undefined,
      search: searchParam ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to list artifacts", error);
    return NextResponse.json({ error: "Failed to list artifacts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const repo = await getRequestArtifactRepository();

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
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty", code: "empty_title" }, { status: 400 });
    }

    const artifactType = b.artifactType as ArtifactType;
    if (!artifactType || !VALID_ARTIFACT_TYPES.includes(artifactType)) {
      return NextResponse.json(
        { error: `artifactType must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}`, code: "invalid_type" },
        { status: 400 },
      );
    }

    const reusabilityScore = typeof b.reusabilityScore === "number" ? b.reusabilityScore : undefined;
    if (reusabilityScore !== undefined && (reusabilityScore < 0 || reusabilityScore > 1)) {
      return NextResponse.json({ error: "reusabilityScore must be between 0.0 and 1.0", code: "invalid_score" }, { status: 400 });
    }

    // Validate UUID arrays if provided
    const validateUuidArray = (arr: unknown, name: string) => {
      if (arr === undefined || arr === null) return undefined;
      if (!Array.isArray(arr)) throw new Error(`${name} must be an array of UUIDs`);
      for (const item of arr) {
        if (typeof item !== "string" || !isValidUuid(item)) {
          throw new Error(`${name} contains invalid UUID: ${item}`);
        }
      }
      return arr as string[];
    };

    let skillIds: string[] | undefined;
    let knowledgeNodeIds: string[] | undefined;
    let questIds: string[] | undefined;
    let activityIds: string[] | undefined;
    let evidenceIds: string[] | undefined;

    try {
      skillIds = validateUuidArray(b.skillIds, "skillIds");
      knowledgeNodeIds = validateUuidArray(b.knowledgeNodeIds, "knowledgeNodeIds");
      questIds = validateUuidArray(b.questIds, "questIds");
      activityIds = validateUuidArray(b.activityIds, "activityIds");
      evidenceIds = validateUuidArray(b.evidenceIds, "evidenceIds");
    } catch (valErr) {
      const msg = valErr instanceof Error ? valErr.message : String(valErr);
      return NextResponse.json({ error: msg, code: "invalid_uuid" }, { status: 400 });
    }


    const input: CreateArtifactInput = {
      title,
      artifactType,
      summary: typeof b.summary === "string" ? b.summary : null,
      description: typeof b.description === "string" ? b.description : null,
      version: typeof b.version === "string" ? b.version : "1.0",
      storagePath: typeof b.storagePath === "string" ? b.storagePath : null,
      externalUrl: typeof b.externalUrl === "string" ? b.externalUrl : null,
      reusabilityScore,
      metadata: typeof b.metadata === "object" && b.metadata !== null ? (b.metadata as Record<string, unknown>) : {},
      lifecycleStatus: (b.lifecycleStatus as ArtifactLifecycleStatus) ?? "active",
      skillIds,
      knowledgeNodeIds,
      questIds,
      activityIds,
      evidenceIds,
    };

    const artifact = await repo.createArtifact(input);
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ArtifactTitleConflictError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }

    const errObj = error as { code?: string; message?: string };
    const code = errObj?.code;
    const msg = error instanceof Error ? error.message : String(errObj?.message ?? error);

    if (code === "23505" || msg.includes("23505") || msg.includes("duplicate key")) {
      return NextResponse.json({ error: "An artifact with this title already exists", code: "artifact_title_conflict" }, { status: 409 });
    }
    if (code === "23503" || msg.includes("23503") || msg.includes("foreign key")) {
      return NextResponse.json({ error: msg, code: "foreign_key_violation" }, { status: 400 });
    }
    if (code === "23514" || msg.includes("23514") || msg.includes("check constraint")) {
      return NextResponse.json({ error: msg, code: "check_constraint_violation" }, { status: 400 });
    }

    console.error("Failed to create artifact", error);
    return NextResponse.json({ error: "Failed to create artifact" }, { status: 500 });

  }
}
