import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { EvidenceSubmissionRepository } from "./repository";
import { EvidenceSubmissionError } from "./types";

export async function getEvidenceSubmissionRepository() {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) throw new AuthRequiredError();
    throw new EvidenceSubmissionError("EVIDENCE_AUTH_UNAVAILABLE");
  }
  if (!data.user) throw new AuthRequiredError();
  return new EvidenceSubmissionRepository(client, data.user.id);
}
