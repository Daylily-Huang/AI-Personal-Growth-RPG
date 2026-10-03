import { authorityResult, onlyFields, requestKey, rewardBody, rewardRoute, text, uuid } from "@/lib/reward/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return rewardRoute(async service => {
    const id = uuid((await context.params).id);
    const body = await rewardBody(request);
    onlyFields(body, ["note", "requestIdempotencyKey"]);
    return authorityResult(await service.refund(id, text(body.note), requestKey(body.requestIdempotencyKey)));
  });
}
