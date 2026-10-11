// Server-only: imports request cookies and the lazy trusted service client.
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ProposalEditRepository } from "./repository";
import { ProposalEditError } from "./types";

export async function getProposalEditRepository(): Promise<ProposalEditRepository> {
  try {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (typeof error.status === "number" && error.status >= 400 && error.status < 500 && error.status !== 429)
        throw new ProposalEditError("PROPOSAL_EDIT_AUTH_REQUIRED");
      throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE");
    }
    if (!data.user) throw new ProposalEditError("PROPOSAL_EDIT_AUTH_REQUIRED");
    return new ProposalEditRepository(client, data.user.id, getSupabaseAdminClient);
  } catch (error) {
    if (error instanceof ProposalEditError && (error.code === "PROPOSAL_EDIT_AUTH_REQUIRED" || error.code === "PROPOSAL_EDIT_UNAVAILABLE")) throw error;
    throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE");
  }
}
