// src/app/api/artifacts/[id]/links/route.ts
// Stage 7B Artifact Batch Relational Link Management Route

import { NextResponse } from "next/server";
import { getRequestArtifactRepository } from "@/lib/store/artifact-repository";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { isValidUuid } from "@/lib/http/validation";
import type { ManageArtifactLinksInput } from "@/types/artifact";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
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

    // Validate link inputs
    const validateLinkArray = (arr: unknown, idField: string, name: string) => {
      if (arr === undefined || arr === null) return undefined;
      if (!Array.isArray(arr)) throw new Error(`${name} must be an array`);
      for (const item of arr) {
        if (!item || typeof item !== "object") throw new Error(`Invalid item in ${name}`);
        const record = item as Record<string, unknown>;
        const entityId = record[idField];
        if (typeof entityId !== "string" || !isValidUuid(entityId)) {
          throw new Error(`Invalid UUID for ${idField} in ${name}: ${String(entityId)}`);
        }
        const action = record.action;
        if (action !== "attach" && action !== "detach") {
          throw new Error(`Action in ${name} must be 'attach' or 'detach'`);
        }
      }
      return arr;
    };

    let activitiesInput: ManageArtifactLinksInput["activities"];
    let skillsInput: ManageArtifactLinksInput["skills"];
    let knowledgeNodesInput: ManageArtifactLinksInput["knowledgeNodes"];
    let questsInput: ManageArtifactLinksInput["quests"];
    let evidenceInput: ManageArtifactLinksInput["evidence"];

    try {
      activitiesInput = validateLinkArray(b.activities, "activityId", "activities") as ManageArtifactLinksInput["activities"];
      skillsInput = validateLinkArray(b.skills, "skillId", "skills") as ManageArtifactLinksInput["skills"];
      knowledgeNodesInput = validateLinkArray(b.knowledgeNodes, "nodeId", "knowledgeNodes") as ManageArtifactLinksInput["knowledgeNodes"];
      questsInput = validateLinkArray(b.quests, "questId", "quests") as ManageArtifactLinksInput["quests"];
      evidenceInput = validateLinkArray(b.evidence, "evidenceId", "evidence") as ManageArtifactLinksInput["evidence"];
    } catch (valErr) {
      const msg = valErr instanceof Error ? valErr.message : String(valErr);
      return NextResponse.json({ error: msg, code: "invalid_input" }, { status: 400 });
    }


    const input: ManageArtifactLinksInput = {
      activities: activitiesInput,
      skills: skillsInput,
      knowledgeNodes: knowledgeNodesInput,
      quests: questsInput,
      evidence: evidenceInput,
    };

    const updatedLinks = await repo.manageArtifactLinks(id, input);
    return NextResponse.json({ links: updatedLinks }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const errObj = error as { code?: string; message?: string };
    const code = errObj?.code;
    const msg = error instanceof Error ? error.message : String(errObj?.message ?? error);

    if (code === "23503" || msg.includes("23503") || msg.includes("foreign key")) {
      return NextResponse.json(
        { error: "Target entity does not exist or does not belong to tenant", code: "foreign_key_violation" },
        { status: 400 },
      );
    }
    if (code === "23505" || msg.includes("23505") || msg.includes("duplicate key")) {
      return NextResponse.json(
        { error: "Link already exists", code: "duplicate_link" },
        { status: 409 },
      );
    }

    console.error("Failed to manage artifact links", error);
    return NextResponse.json({ error: "Failed to manage artifact links" }, { status: 500 });

  }
}
