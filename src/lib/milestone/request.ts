import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { MilestoneRepository } from "./repository";

export async function getMilestoneRepository() {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new MilestoneRepository(client, data.user.id);
}
