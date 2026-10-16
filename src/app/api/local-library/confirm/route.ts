import { SupabaseRepository } from "@/lib/store/supabase-repository";
import { EvidenceSubmissionRepository } from "@/lib/evidence-submission/repository";
import { ConfirmSchema } from "@/lib/local-library/schema";
import { confirmLibrary } from "@/lib/local-library/store";
import { libraryBody, libraryFailure, libraryResponse, libraryUser } from "@/lib/local-library/http";

export async function POST(request: Request) {
  try {
    const { client, userId } = await libraryUser(request);
    const input = ConfirmSchema.parse(await libraryBody(request));
    const activities = new SupabaseRepository(client, userId), evidence = new EvidenceSubmissionRepository(client, userId);
    const receipt = await confirmLibrary(userId, input, {
      create: async rawInput => (await activities.addActivity({ rawInput })).id,
      evidence: async (activityId, requestId, description) => (await evidence.submit(activityId, { requestId, skillId: null, description })).submission.evidence.id,
    });
    return libraryResponse(receipt, receipt.replayed ? 200 : 201);
  } catch (error) { return libraryFailure(error); }
}
