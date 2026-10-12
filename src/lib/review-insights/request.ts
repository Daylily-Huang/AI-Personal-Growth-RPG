import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewInsightsRepository, type ReviewReadClient } from "./repository";
import { ReviewError } from "./types";

export async function getReviewInsightsRepository() {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ReviewError("REVIEW_AUTH_REQUIRED");
  return new ReviewInsightsRepository(client as unknown as ReviewReadClient, data.user.id);
}
