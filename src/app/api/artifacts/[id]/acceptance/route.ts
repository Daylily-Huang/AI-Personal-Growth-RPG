import { artifactAcceptanceBody, artifactAcceptanceJson, artifactAcceptanceNoQuery, artifactAcceptanceRoute } from "@/lib/artifact-acceptance/http";
import { artifactAcceptanceUuid, parseAcceptArtifactInput } from "@/lib/artifact-acceptance/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return artifactAcceptanceRoute(async repo => {
    const id = artifactAcceptanceUuid((await context.params).id); artifactAcceptanceNoQuery(request);
    return artifactAcceptanceJson(await repo.get(id));
  });
}
export async function POST(request: Request, context: Context) {
  return artifactAcceptanceRoute(async repo => {
    const id = artifactAcceptanceUuid((await context.params).id);
    return artifactAcceptanceJson(await repo.accept(id, parseAcceptArtifactInput(await artifactAcceptanceBody(request))));
  });
}
