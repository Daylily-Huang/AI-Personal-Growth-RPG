import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { StrategyRepository } from "./repository";

export async function getStrategyRepository(): Promise<StrategyRepository> {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new StrategyRepository(client, data.user.id);
}
