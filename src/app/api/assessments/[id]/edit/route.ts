import { getProposalEditRepository } from "@/lib/proposal-edit/request";
import { proposalEditFailure, proposalEditResponse, proposalEditResultResponse,
  proposalFactSkillsResponse } from "@/lib/proposal-edit/http";
import { validateProposalEditPostHeaders, readProposalEditBody } from "@/lib/proposal-edit/http";
import { parseProposalEditInput, parseProposalEditQuery, proposalFactUuid } from "@/lib/proposal-edit/validation";
import { ProposalEditService } from "@/lib/proposal-edit/service";
import { evaluateProposalFacts } from "@/lib/proposal-edit/ai";

/** Explicit editor reads only; request lookup never resumes or repeats AI. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repository = await getProposalEditRepository();
    const assessmentId = proposalFactUuid((await context.params).id);
    const query = parseProposalEditQuery(new URL(request.url).searchParams);
    if (query.view === "facts") return proposalEditResponse(await repository.readFacts(assessmentId));
    if (query.view === "skills") return proposalFactSkillsResponse(await repository.readSkills(assessmentId, query.after));
    const result = await repository.readRequest(assessmentId, query.requestId);
    return proposalEditResultResponse({ replayed: true, request: result });
  } catch (error) { return proposalEditFailure(error); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repository = await getProposalEditRepository();
    validateProposalEditPostHeaders(request);
    const assessmentId = proposalFactUuid((await context.params).id);
    const input = parseProposalEditInput(await readProposalEditBody(request));
    const service = new ProposalEditService(repository, async pending => evaluateProposalFacts(await repository.readModelContext(pending)));
    return proposalEditResultResponse(await service.submit(assessmentId, input));
  } catch (error) { return proposalEditFailure(error); }
}
