import { bodyObject, milestoneJson, milestoneRoute, noQuery, onlyFields, requestKey, text, uuid } from "@/lib/milestone/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return milestoneRoute(async repo => {
    noQuery(request);
    const id = uuid((await context.params).id);
    const body = await bodyObject(request);
    onlyFields(body, ["revocationReason", "revocationRequestIdempotencyKey"]);
    return milestoneJson(await repo.revoke(id, text(body.revocationReason), requestKey(body.revocationRequestIdempotencyKey)));
  });
}
