import { getEvidenceSubmissionRepository } from "@/lib/evidence-submission/request";
import { evidenceFailure, evidenceResponse, readEvidenceBody, validateEvidencePostHeaders } from "@/lib/evidence-submission/http";
import { EvidenceSubmissionError } from "@/lib/evidence-submission/types";
import { evidenceUuid, parseEvidenceInput, parseEvidenceQuery } from "@/lib/evidence-submission/validation";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const repository = await getEvidenceSubmissionRepository();
    const activityId = evidenceUuid((await context.params).id);
    const query = parseEvidenceQuery(new URL(request.url).searchParams);
    return evidenceResponse(await repository.list(activityId, query));
  } catch (error) { return evidenceFailure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const repository = await getEvidenceSubmissionRepository();
    const activityId = evidenceUuid((await context.params).id);
    if (new URL(request.url).search) throw new EvidenceSubmissionError("INVALID_EVIDENCE_INPUT");
    validateEvidencePostHeaders(request);
    const input = parseEvidenceInput(await readEvidenceBody(request));
    const result = await repository.submit(activityId, input);
    return evidenceResponse(result, result.replayed ? 200 : 201);
  } catch (error) { return evidenceFailure(error); }
}
