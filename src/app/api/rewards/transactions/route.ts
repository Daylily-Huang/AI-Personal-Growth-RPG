import { pagination, rewardJson, rewardRoute } from "@/lib/reward/http";

export async function GET(request: Request) {
  return rewardRoute(async service => {
    const page = await service.transactions(pagination(request));
    return rewardJson({ transactions: page.items, nextOffset: page.nextOffset });
  });
}
