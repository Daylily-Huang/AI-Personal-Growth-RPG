import { NextResponse } from "next/server";
import { phase8BErrorResponse, readJsonObject, requireNonBlankString, requireUuid } from "@/lib/outer-loop/http";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import type { ProposalDecision } from "@/lib/outer-loop/types";

const DECISIONS: ProposalDecision[] = ["ACCEPTED", "EDITED", "REJECTED"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repo = await getPhase8BRepository();
    const { id: rawId } = await context.params;
    const proposalId = requireUuid(rawId, "proposalId");
    const body = await readJsonObject(request);
    const decision = body.decision;
    if (typeof decision !== "string" || !DECISIONS.includes(decision as ProposalDecision)) {
      return NextResponse.json({ error: "decision must be ACCEPTED, EDITED, or REJECTED", code: "INVALID_PROPOSAL_DECISION" }, { status: 400 });
    }
    const editedPayload = body.editedPayload;
    if (editedPayload !== undefined && (editedPayload === null || typeof editedPayload !== "object" || Array.isArray(editedPayload))) {
      return NextResponse.json({ error: "editedPayload must be an object when provided", code: "INVALID_INPUT" }, { status: 400 });
    }
    const result = await repo.reviewProposal(
      proposalId,
      decision as ProposalDecision,
      requireNonBlankString(body.reviewRequestIdempotencyKey, "reviewRequestIdempotencyKey"),
      editedPayload as Record<string, unknown> | undefined,
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() || null : null,
    );
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    return phase8BErrorResponse(error, "Failed to review outer-loop proposal");
  }
}
