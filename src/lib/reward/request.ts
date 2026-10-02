import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { RewardRepository } from "./repository";

export async function getRewardRepository(): Promise<RewardRepository> {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new RewardRepository(client, data.user.id);
}
