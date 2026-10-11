import {
  ProposalEditError, type ProposalEditInput, type ProposalEditModelResult,
  type ProposalEditRequest, type ProposalEditRequestPort, type ProposalEditResult,
} from "./types";
import { parseProposalEditInput, parseProposalEditModelResult, proposalFactUuid, sameProposalFacts } from "./validation";

/** Called once, outside any RPC transaction, only after a persisted dispatch=true. */
export type ProposalEditEvaluator = (request: Readonly<{
  requestId: string; activityId: string; baseAssessmentId: string; facts: ProposalEditInput["facts"];
}>) => Promise<ProposalEditModelResult>;

function matches(request: ProposalEditRequest, assessmentId: string, input: ProposalEditInput): void {
  if (request.baseAssessmentId !== assessmentId || request.requestId !== input.requestId || !sameProposalFacts(request.facts, input.facts))
    throw new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT");
}

/**
 * No retries, new keys, leases or in-memory lock authority. A lost begin/commit
 * response is reconciled with one read of the same persisted key, never AI.
 */
export class ProposalEditService {
  constructor(private readonly repository: ProposalEditRequestPort, private readonly evaluate: ProposalEditEvaluator) {}

  private async reconcile(assessmentId: string, input: ProposalEditInput): Promise<ProposalEditResult> {
    const request = await this.repository.readRequest(assessmentId, input.requestId);
    matches(request, assessmentId, input);
    return { replayed: true, request };
  }

  async submit(assessment: string, value: ProposalEditInput): Promise<ProposalEditResult> {
    const assessmentId = proposalFactUuid(assessment), input = parseProposalEditInput(value);
    let begin;
    try { begin = await this.repository.begin(assessmentId, input); }
    catch (error) {
      if (error instanceof ProposalEditError && error.code === "PROPOSAL_EDIT_UNAVAILABLE") return this.reconcile(assessmentId, input);
      throw error;
    }
    matches(begin.request, assessmentId, input);
    if (!begin.dispatch) return { replayed: true, request: begin.request };
    if (begin.request.status !== "in_progress") throw new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT");

    let result: ProposalEditModelResult;
    try {
      // A separate canonical copy prevents even an adapter from changing the durable tuple.
      const facts = parseProposalEditInput(input).facts;
      Object.freeze(facts.relatedSkillIds); Object.freeze(facts);
      result = parseProposalEditModelResult(await this.evaluate(Object.freeze({ requestId: input.requestId,
        activityId: begin.request.activityId, baseAssessmentId: assessmentId, facts })));
    } catch {
      try {
        const request = await this.repository.fail(assessmentId, input);
        matches(request, assessmentId, input);
        if (request.status === "in_progress") throw new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT");
        return { replayed: request.status === "completed", request };
      } catch (error) {
        if (error instanceof ProposalEditError && error.code === "PROPOSAL_EDIT_UNAVAILABLE") return this.reconcile(assessmentId, input);
        throw error;
      }
    }

    try {
      const request = await this.repository.complete(assessmentId, input, result);
      matches(request, assessmentId, input);
      if (request.status === "in_progress" || request.status === "failed") throw new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT");
      return { replayed: false, request };
    } catch (error) {
      // A commit may have succeeded. Do not overwrite it with fail or resubmit AI.
      if (error instanceof ProposalEditError && error.code === "PROPOSAL_EDIT_UNAVAILABLE") return this.reconcile(assessmentId, input);
      throw error;
    }
  }
}
