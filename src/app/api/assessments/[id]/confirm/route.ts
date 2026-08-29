import { NextResponse } from "next/server";
import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { SettlementService } from "@/lib/store/settlement.service";
import { isValidUuid } from "@/lib/http/validation";
import type { ArtifactResolutionInput } from "@/types/artifact";

const BAD_REQUEST_REASONS = new Set([
  "incomplete_proposal_coverage",
  "unexpected_artifact_resolutions",
  "missing_proposal_index",
  "invalid_proposal_index",
  "out_of_range_proposal_index",
  "duplicate_proposal_index",
  "invalid_existing_artifact_id",
  "invalid_artifact_resolution",
  "invalid_activity_role",
  "invalid_approved_overrides",
  "empty_artifact_title",
  "invalid_artifact_type",
  "missing_or_invalid_skill_resolution",
  "empty_proposed_skill_name",
  "invalid_related_skill_resolution",
  "empty_related_skill_proposed_name",
]);


const NOT_FOUND_REASONS = new Set([
  "not_found",
  "activity_not_found",
  "not_owned",
  "skill_not_found_or_not_owned",
  "related_skill_not_found_or_not_owned",
  "artifact_not_found_or_not_owned",
]);

const CONFLICT_REASONS = new Set([
  "already_confirmed",
  "already_settled",
  "artifact_title_conflict",
  "repetition_conflict",
  "repetition_conflict_retry_exhausted",
  "xp_delta_mismatch",
  "skill_xp_delta_mismatch",
  "skill_name_mismatch",
]);

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getRequestRepository();
    const { id } = await ctx.params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "id must be a valid UUID", code: "invalid_uuid" }, { status: 400 });
    }

    let artifactResolutions: ArtifactResolutionInput[] | undefined;

    const contentType = request.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        const body = await request.json();
        if (body && typeof body === "object") {
          const b = body as Record<string, unknown>;
          if ("artifactResolutions" in b) {
            if (!Array.isArray(b.artifactResolutions)) {
              return NextResponse.json(
                { error: "artifactResolutions must be an array", code: "invalid_payload" },
                { status: 400 },
              );
            }
            artifactResolutions = b.artifactResolutions as ArtifactResolutionInput[];
          }
        }
      } catch {
        return NextResponse.json({ error: "Malformed JSON body", code: "malformed_json" }, { status: 400 });
      }
    }

    const result = await new SettlementService(repo).confirmAssessment(id, {
      artifactResolutions,
    });


    if (!result.ok) {
      const reason = result.reason ?? "unknown_error";
      let status = 409;
      if (NOT_FOUND_REASONS.has(reason)) {
        status = 404;
      } else if (BAD_REQUEST_REASONS.has(reason)) {
        status = 400;
      } else if (CONFLICT_REASONS.has(reason)) {
        status = 409;
      }

      return NextResponse.json(
        {
          error: reason,
          code: reason,
          assessment: result.assessment,
          actualRepetitionCount: result.actualRepetitionCount,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        transaction: result.transaction,
        assessment: result.assessment,
        masteryVerification: result.masteryVerification,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const errObj = error as { code?: string; message?: string };
    const code = errObj?.code;
    const msg = error instanceof Error ? error.message : String(errObj?.message ?? error);

    if (code === "P0002" || msg.includes("not_found_or_not_owned") || code === "not_found") {
      return NextResponse.json({ error: "Target entity does not exist or does not belong to tenant", code: "not_found" }, { status: 404 });
    }
    if (code === "23503" || msg.includes("23503") || msg.includes("foreign key")) {
      return NextResponse.json({ error: "Target entity does not exist or does not belong to tenant", code: "not_found" }, { status: 404 });
    }
    if (code === "23505" || msg.includes("23505") || msg.includes("artifact_title_conflict") || msg.includes("duplicate key")) {
      return NextResponse.json({ error: "An artifact with this title already exists", code: "artifact_title_conflict" }, { status: 409 });
    }
    if (code === "22023" || msg.includes("invalid_") || msg.includes("out_of_range") || msg.includes("duplicate_") || msg.includes("incomplete_")) {
      return NextResponse.json({ error: msg, code: "invalid_payload" }, { status: 400 });
    }

    console.error("Failed to confirm assessment", error);
    return NextResponse.json({ error: "Failed to confirm assessment" }, { status: 500 });
  }
}

