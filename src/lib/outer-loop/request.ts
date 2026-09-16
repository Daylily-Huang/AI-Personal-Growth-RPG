import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { Phase8BRepository } from "./repository";

export async function getPhase8BRepository(): Promise<Phase8BRepository> {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new Phase8BRepository(client, data.user.id);
}
