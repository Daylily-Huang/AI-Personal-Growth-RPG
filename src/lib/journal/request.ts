import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { JournalRepository } from "./repository";

export async function getJournalRepository(): Promise<JournalRepository> {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new JournalRepository(client, data.user.id);
}
