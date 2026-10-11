import { getProposalEditRepository } from "@/lib/proposal-edit/request";
import { proposalEditFailure, proposalFactHistoryResponse } from "@/lib/proposal-edit/http";
import { parseProposalFactHistoryQuery, proposalFactUuid } from "@/lib/proposal-edit/validation";

/** Authenticated, RLS-only history. Never dispatches AI or exposes its JSON. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const repository = await getProposalEditRepository();
    const activityId = proposalFactUuid((await context.params).id);
    const { after } = parseProposalFactHistoryQuery(new URL(request.url).searchParams);
    return proposalFactHistoryResponse(await repository.readHistory(activityId, after));
  } catch (error) { return proposalEditFailure(error); }
}
