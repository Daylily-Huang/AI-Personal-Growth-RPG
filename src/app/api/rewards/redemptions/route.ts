import { pagination, rewardJson, rewardRoute } from "@/lib/reward/http";

export async function GET(request: Request) {
  return rewardRoute(async service => {
    const page = await service.redemptions(pagination(request));
    return rewardJson({ redemptions: page.items, nextOffset: page.nextOffset });
  });
}
