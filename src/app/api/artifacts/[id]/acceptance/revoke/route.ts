import { artifactAcceptanceBody, artifactAcceptanceJson, artifactAcceptanceRoute } from "@/lib/artifact-acceptance/http";
import { artifactAcceptanceUuid, parseRevokeArtifactInput } from "@/lib/artifact-acceptance/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return artifactAcceptanceRoute(async repo => {
    const id = artifactAcceptanceUuid((await context.params).id);
    return artifactAcceptanceJson(await repo.revoke(id, parseRevokeArtifactInput(await artifactAcceptanceBody(request))));
  });
}
