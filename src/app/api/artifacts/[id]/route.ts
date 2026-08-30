// src/app/api/artifacts/[id]/route.ts
// Stage 7B Artifact Detail, Update & Delete Endpoint

import { NextResponse } from "next/server";
import {
  getRequestArtifactRepository,
  ReferencedByProvenanceError,
  ArtifactTitleConflictError,
} from "@/lib/store/artifact-repository";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";
import type { ArtifactType, ArtifactLifecycleStatus, UpdateArtifactInput } from "@/types/artifact";

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

const VALID_STATUSES = ["active", "archived", "draft", "superseded"];

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "id must be a valid UUID", code: "invalid_uuid" }, { status: 400 });
    }

    const repo = await getRequestArtifactRepository();
    const detail = await repo.getArtifactDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Artifact not found", code: "not_found" }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Failed to get artifact detail", error);
    return NextResponse.json({ error: "Failed to get artifact detail" }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "id must be a valid UUID", code: "invalid_uuid" }, { status: 400 });
    }

    const repo = await getRequestArtifactRepository();
    const existing = await repo.getArtifact(id);
    if (!existing) {
      return NextResponse.json({ error: "Artifact not found", code: "not_found" }, { status: 404 });
    }

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
    const updates: UpdateArtifactInput = {};

    if (b.title !== undefined) {
      if (typeof b.title !== "string" || !b.title.trim()) {
        return NextResponse.json({ error: "Title cannot be empty", code: "empty_title" }, { status: 400 });
      }
      updates.title = b.title.trim();
    }

    if (b.artifactType !== undefined) {
      if (!VALID_ARTIFACT_TYPES.includes(b.artifactType as ArtifactType)) {
        return NextResponse.json(
          { error: `artifactType must be one of: ${VALID_ARTIFACT_TYPES.join(", ")}`, code: "invalid_type" },
          { status: 400 },
        );
      }
      updates.artifactType = b.artifactType as ArtifactType;
    }

    if (b.summary !== undefined) {
      updates.summary = typeof b.summary === "string" ? b.summary : null;
    }

    if (b.description !== undefined) {
      updates.description = typeof b.description === "string" ? b.description : null;
    }

    if (b.version !== undefined) {
      updates.version = typeof b.version === "string" ? b.version : null;
    }

    if (b.storagePath !== undefined) {
      updates.storagePath = typeof b.storagePath === "string" ? b.storagePath : null;
    }

    if (b.externalUrl !== undefined) {
      updates.externalUrl = typeof b.externalUrl === "string" ? b.externalUrl : null;
    }

    if (b.reusabilityScore !== undefined) {
      if (typeof b.reusabilityScore !== "number" || b.reusabilityScore < 0 || b.reusabilityScore > 1) {
        return NextResponse.json({ error: "reusabilityScore must be between 0.0 and 1.0", code: "invalid_score" }, { status: 400 });
      }
      updates.reusabilityScore = b.reusabilityScore;
    }

    if (b.metadata !== undefined) {
      if (typeof b.metadata !== "object" || b.metadata === null) {
        return NextResponse.json({ error: "metadata must be an object", code: "invalid_metadata" }, { status: 400 });
      }
      updates.metadata = b.metadata as Record<string, unknown>;
    }

    if (b.lifecycleStatus !== undefined && b.isArchived !== undefined) {
      if (b.isArchived === true && b.lifecycleStatus !== "archived") {
        return NextResponse.json(
          {
            error: "Contradictory lifecycle status: isArchived=true requires lifecycleStatus='archived'",
            code: "invalid_lifecycle_combination",
          },
          { status: 400 },
        );
      }
      if (b.isArchived === false && b.lifecycleStatus === "archived") {
        return NextResponse.json(
          {
            error: "Contradictory lifecycle status: isArchived=false cannot have lifecycleStatus='archived'",
            code: "invalid_lifecycle_combination",
          },
          { status: 400 },
        );
      }
    }

    if (b.lifecycleStatus !== undefined) {
      if (!VALID_STATUSES.includes(b.lifecycleStatus as string)) {
        return NextResponse.json(
          { error: `lifecycleStatus must be one of: ${VALID_STATUSES.join(", ")}`, code: "invalid_status" },
          { status: 400 },
        );
      }
      updates.lifecycleStatus = b.lifecycleStatus as ArtifactLifecycleStatus;
      if (b.isArchived === undefined) {
        updates.isArchived = b.lifecycleStatus === "archived";
      }
    }

    if (b.isArchived !== undefined) {
      if (typeof b.isArchived !== "boolean") {
        return NextResponse.json({ error: "isArchived must be a boolean", code: "invalid_boolean" }, { status: 400 });
      }
      updates.isArchived = b.isArchived;
      if (b.lifecycleStatus === undefined) {
        updates.lifecycleStatus = b.isArchived ? "archived" : (existing.lifecycleStatus === "archived" ? "active" : existing.lifecycleStatus);
      }
    }


    const updated = await repo.updateArtifact(id, updates);
    return NextResponse.json({ artifact: updated }, { status: 200 });
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
    if (code === "23514" || msg.includes("23514") || msg.includes("check constraint")) {
      return NextResponse.json({ error: msg, code: "check_constraint_violation" }, { status: 400 });
    }

    console.error("Failed to update artifact", error);
    return NextResponse.json({ error: "Failed to update artifact" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "id must be a valid UUID", code: "invalid_uuid" }, { status: 400 });
    }

    const repo = await getRequestArtifactRepository();
    const existing = await repo.getArtifact(id);
    if (!existing) {
      return NextResponse.json({ error: "Artifact not found", code: "not_found" }, { status: 404 });
    }

    await repo.deleteArtifact(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ReferencedByProvenanceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 409 },
      );
    }

    const errObj = error as { code?: string; message?: string };
    const code = errObj?.code;
    const msg = error instanceof Error ? error.message : String(errObj?.message ?? error);

    if (code === "23503" || msg.includes("23503") || msg.includes("referenced by")) {
      return NextResponse.json(
        {
          error: "Cannot delete artifact referenced by knowledge provenance or evidence records. Please archive instead.",
          code: "referenced_by_provenance",
        },
        { status: 409 },
      );
    }

    console.error("Failed to delete artifact", error);
    return NextResponse.json({ error: "Failed to delete artifact" }, { status: 500 });
  }
}

