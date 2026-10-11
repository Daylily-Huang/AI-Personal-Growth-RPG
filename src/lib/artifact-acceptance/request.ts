import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ArtifactAcceptanceRepository } from "./repository";
import { ArtifactAcceptanceError } from "./types";

export async function getArtifactAcceptanceRepository(): Promise<ArtifactAcceptanceRepository> {
  try {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (typeof error.status === "number" && error.status >= 400 && error.status < 500 && error.status !== 429)
        throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_AUTH_REQUIRED");
      throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_UNAVAILABLE");
    }
    if (!data.user) throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_AUTH_REQUIRED");
    return new ArtifactAcceptanceRepository(client, data.user.id);
  } catch (error) {
    if (error instanceof ArtifactAcceptanceError && ["ARTIFACT_ACCEPTANCE_AUTH_REQUIRED", "ARTIFACT_ACCEPTANCE_UNAVAILABLE"].includes(error.message)) throw error;
    throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_UNAVAILABLE");
  }
}
