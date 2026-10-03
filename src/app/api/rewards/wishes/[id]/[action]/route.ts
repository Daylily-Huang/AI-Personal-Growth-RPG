import { authorityResult, onlyFields, optionalText, requestKey, rewardBody, RewardHttpError, rewardRoute, uuid } from "@/lib/reward/http";
import { WISH_ACTIONS, type WishAction } from "@/lib/reward/types";

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  return rewardRoute(async service => {
    const params = await context.params;
    const id = uuid(params.id);
    if (!WISH_ACTIONS.includes(params.action as WishAction)) throw new RewardHttpError("ACTION_NOT_FOUND", 404);
    const action = params.action as WishAction;
    const body = await rewardBody(request);
    onlyFields(body, action === "redeem" ? ["requestIdempotencyKey", "celebrationNote"] : ["requestIdempotencyKey"]);
    return authorityResult(await service.wishAction(id, action, requestKey(body.requestIdempotencyKey), optionalText(body.celebrationNote)));
  });
}
