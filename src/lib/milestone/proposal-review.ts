import type { Phase8BRepository } from "@/lib/outer-loop/repository";
import { MilestoneHttpError } from "./errors";
import { bodyObject, milestoneJson, nullableText, onlyFields, requestKey } from "./http";
import type { ProposalDecision } from "./types";

/** Owned MILESTONE routing only. Semantic v2 validation stays inside the replay-aware SQL RPC. */
export async function reviewMilestoneProposal(request: Request, id: string, repo: Pick<Phase8BRepository, "reviewProposal">) {
  const body = await bodyObject(request);
  onlyFields(body, ["decision", "reviewRequestIdempotencyKey", "editedPayload", "rejectionReason"]);
  if (typeof body.decision !== "string" || !["ACCEPTED", "EDITED", "REJECTED"].includes(body.decision)) throw new MilestoneHttpError("INVALID_PROPOSAL_DECISION");
  if (body.editedPayload !== undefined && (!body.editedPayload || typeof body.editedPayload !== "object" || Array.isArray(body.editedPayload))) {
    throw new MilestoneHttpError("INVALID_INPUT");
  }
  const result = await repo.reviewProposal(id, body.decision as ProposalDecision, requestKey(body.reviewRequestIdempotencyKey),
    body.editedPayload as Record<string, unknown> | undefined, nullableText(body.rejectionReason));
  return milestoneJson({ result });
}
