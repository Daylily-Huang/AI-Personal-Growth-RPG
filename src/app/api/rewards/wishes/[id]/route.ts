import { rewardBody, rewardJson, rewardRoute, uuid, wishMetadata } from "@/lib/reward/http";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return rewardRoute(async service => rewardJson({ wish: await service.wish(uuid((await context.params).id)) }));
}
export async function PATCH(request: Request, context: Context) {
  return rewardRoute(async service => {
    const id = uuid((await context.params).id);
    const input = wishMetadata(await rewardBody(request), false);
    return rewardJson({ wish: await service.editWish(id, input) });
  });
}
